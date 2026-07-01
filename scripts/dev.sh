#!/usr/bin/env bash
# 一键启动前后端开发服务
# 重复执行 = 重启（先清理旧进程再启动）
#
# 用法:
#   ./scripts/dev.sh          # 启动前后端
#   ./scripts/dev.sh --stop   # 仅停止服务
#   ./scripts/dev.sh backend  # 仅启动后端
#   ./scripts/dev.sh frontend # 仅启动前端
#
# 端口:
#   前端: 5173  (可通过 FRONTEND_PORT 覆盖)
#   后端: 8765  (可通过 BACKEND_PORT 覆盖)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8765}"

FRONTEND_DIR="$PROJECT_ROOT/apps/dsa-web"
BACKEND_DIR="$PROJECT_ROOT"

LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
FRONTEND_LOG="$LOG_DIR/dev-frontend.log"
BACKEND_LOG="$LOG_DIR/dev-backend.log"

PID_FILE="$PROJECT_ROOT/.dev.pids"

# ---------- Python 解释器检测 ----------

find_python() {
  # 1. 显式指定优先
  if [ -n "${PYTHON:-}" ] && command -v "$PYTHON" >/dev/null 2>&1; then
    if "$PYTHON" -c "import uvicorn" >/dev/null 2>&1; then
      echo "$PYTHON"
      return 0
    fi
  fi

  # 2. 项目虚拟环境
  for venv_dir in "$PROJECT_ROOT/.venv" "$PROJECT_ROOT/venv"; do
    if [ -x "$venv_dir/bin/python" ]; then
      if "$venv_dir/bin/python" -c "import uvicorn" >/dev/null 2>&1; then
        echo "$venv_dir/bin/python"
        return 0
      fi
    fi
  done

  # 3. conda base 环境
  for conda_python in \
    "$HOME/miniconda3/bin/python3" \
    "$HOME/miniconda/bin/python3" \
    "/opt/miniconda3/bin/python3" \
    "/opt/miniconda/bin/python3" \
    "$HOME/anaconda3/bin/python3" \
    "$HOME/anaconda/bin/python3"; do
    if [ -x "$conda_python" ]; then
      if "$conda_python" -c "import uvicorn" >/dev/null 2>&1; then
        echo "$conda_python"
        return 0
      fi
    fi
  done

  # 4. 当前 PATH 中的 python3（检查是否有 uvicorn）
  if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import uvicorn" >/dev/null 2>&1; then
      echo "$(command -v python3)"
      return 0
    fi
  fi

  # 5. 当前 PATH 中的 python
  if command -v python >/dev/null 2>&1; then
    if python -c "import uvicorn" >/dev/null 2>&1; then
      echo "$(command -v python)"
      return 0
    fi
  fi

  return 1
}

PYTHON_BIN=""
if ! PYTHON_BIN=$(find_python); then
  echo "❌ 未找到带有 uvicorn 的 Python 解释器"
  echo ""
  echo "请尝试以下方法之一："
  echo "  1. 激活包含 uvicorn 的虚拟环境后再运行"
  echo "  2. 通过 PYTHON 环境变量指定：PYTHON=/path/to/python ./scripts/dev.sh"
  echo "  3. 安装依赖：pip install uvicorn -r requirements.txt"
  exit 1
fi
PYTHON_DIR="$(dirname "$PYTHON_BIN")"

# ---------- 工具函数 ----------

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

info() {
  echo -e "[$(timestamp)] \033[1;34mINFO\033[0m  $*"
}

warn() {
  echo -e "[$(timestamp)] \033[1;33mWARN\033[0m  $*"
}

success() {
  echo -e "[$(timestamp)] \033[1;32mOK\033[0m    $*"
}

error() {
  echo -e "[$(timestamp)] \033[1;31mERROR\033[0m $*" >&2
}

# 查找占用指定端口的进程 PID
find_port_pids() {
  local port="$1"
  lsof -ti:"$port" 2>/dev/null || true
}

# 优雅停止进程组
kill_process_tree() {
  local pid="$1"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # 先尝试终止子进程
    local children
    children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
      kill_process_tree "$child"
    done
    kill "$pid" 2>/dev/null || true
  fi
}

# 停止旧服务
stop_services() {
  info "停止旧服务..."

  local stopped_any=0

  # 清理前端端口
  local frontend_pids
  frontend_pids=$(find_port_pids "$FRONTEND_PORT")
  if [ -n "$frontend_pids" ]; then
    for pid in $frontend_pids; do
      local cmd
      cmd=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
      warn "  前端端口 $FRONTEND_PORT 被 PID=$pid ($cmd) 占用，正在停止..."
      kill_process_tree "$pid"
      stopped_any=1
    done
  fi

  # 清理后端端口
  local backend_pids
  backend_pids=$(find_port_pids "$BACKEND_PORT")
  if [ -n "$backend_pids" ]; then
    for pid in $backend_pids; do
      local cmd
      cmd=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
      warn "  后端端口 $BACKEND_PORT 被 PID=$pid ($cmd) 占用，正在停止..."
      kill_process_tree "$pid"
      stopped_any=1
    done
  fi

  # 如果记录了 PID 文件，额外清理
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      local name pid
      name=$(echo "$line" | cut -d: -f1)
      pid=$(echo "$line" | cut -d: -f2)
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        warn "  停止记录的 $name 进程 PID=$pid..."
        kill_process_tree "$pid"
        stopped_any=1
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi

  # 等待端口释放
  local waited=0
  while [ $waited -lt 10 ]; do
    local f_pids b_pids
    f_pids=$(find_port_pids "$FRONTEND_PORT")
    b_pids=$(find_port_pids "$BACKEND_PORT")
    if [ -z "$f_pids" ] && [ -z "$b_pids" ]; then
      break
    fi
    sleep 0.5
    waited=$((waited + 1))
  done

  if [ $stopped_any -eq 1 ]; then
    success "旧服务已停止"
  else
    info "没有发现正在运行的旧服务"
  fi
}

# 检查端口是否就绪
wait_for_port() {
  local port="$1"
  local label="$2"
  local max_wait="${3:-30}"
  local waited=0

  while [ $waited -lt $max_wait ]; do
    if lsof -ti:"$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
    printf "  等待 %s 启动... %ds\r" "$label" "$waited"
  done
  echo ""
  return 1
}

# ---------- 启动函数 ----------

start_backend() {
  info "启动后端服务 (端口: $BACKEND_PORT)..."
  info "  Python: $PYTHON_BIN"

  cd "$BACKEND_DIR"
  PATH="$PYTHON_DIR:$PATH" nohup "$PYTHON_BIN" -m uvicorn server:app \
    --reload \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    > "$BACKEND_LOG" 2>&1 &
  local backend_pid=$!

  echo "backend:$backend_pid" >> "$PID_FILE"

  if wait_for_port "$BACKEND_PORT" "后端" 30; then
    success "后端已启动 → http://localhost:$BACKEND_PORT"
    info "  后端日志: $BACKEND_LOG"
  else
    error "后端启动超时 (30s)，请检查日志: $BACKEND_LOG"
    tail -30 "$BACKEND_LOG" 2>/dev/null || true
    return 1
  fi
}

start_frontend() {
  info "启动前端服务 (端口: $FRONTEND_PORT)..."

  cd "$FRONTEND_DIR"
  BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" \
    nohup npm run dev \
    > "$FRONTEND_LOG" 2>&1 &
  local frontend_pid=$!

  echo "frontend:$frontend_pid" >> "$PID_FILE"

  if wait_for_port "$FRONTEND_PORT" "前端" 30; then
    success "前端已启动 → http://localhost:$FRONTEND_PORT"
    info "  前端日志: $FRONTEND_LOG"
  else
    error "前端启动超时 (30s)，请检查日志: $FRONTEND_LOG"
    tail -30 "$FRONTEND_LOG" 2>/dev/null || true
    return 1
  fi
}

# ---------- 主流程 ----------

main() {
  local mode="${1:-all}"

  case "$mode" in
    --stop|-s|stop)
      stop_services
      exit 0
      ;;
    backend|be)
      stop_services
      start_backend
      ;;
    frontend|fe)
      stop_services
      start_frontend
      ;;
    all|--help|-h|help|"")
      if [ "$mode" = "--help" ] || [ "$mode" = "-h" ] || [ "$mode" = "help" ]; then
        echo "用法: $0 [命令]"
        echo ""
        echo "命令:"
        echo "  all       启动前后端 (默认)"
        echo "  backend   仅启动后端"
        echo "  frontend  仅启动前端"
        echo "  stop      停止服务"
        echo ""
        echo "环境变量:"
        echo "  FRONTEND_PORT  前端端口 (默认 5173)"
        echo "  BACKEND_PORT   后端端口 (默认 8765)"
        exit 0
      fi

      echo ""
      echo "============================================"
      echo "   DSA 开发服务一键启动"
      echo "============================================"
      echo ""

      stop_services
      echo ""

      # 清空 PID 文件
      > "$PID_FILE"

      start_backend
      echo ""
      start_frontend
      echo ""

      success "所有服务已启动！"
      echo ""
      echo "  🌐 前端页面:  http://localhost:$FRONTEND_PORT"
      echo "  🔧 后端 API:  http://localhost:$BACKEND_PORT"
      echo "  📋 API 文档:  http://localhost:$BACKEND_PORT/docs"
      echo ""
      echo "  📄 前端日志:  $FRONTEND_LOG"
      echo "  📄 后端日志:  $BACKEND_LOG"
      echo ""
      echo "  停止服务:    $0 --stop"
      echo "  重启服务:    再次执行 $0"
      echo ""
      ;;
    *)
      error "未知命令: $mode"
      echo "使用 $0 --help 查看帮助"
      exit 1
      ;;
  esac
}

main "$@"
