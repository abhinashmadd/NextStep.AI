import os
import sys
import time
import urllib.request
import subprocess
import signal

def find_dir(candidates, check_file):
    for c in candidates:
        if os.path.isdir(c) and os.path.exists(os.path.join(c, check_file)):
            return c
    return candidates[0]

def main():
    print("=== Starting NextStep Application Services (Production) ===", flush=True)

    base_dir = os.path.abspath(os.path.dirname(__file__))
    model_candidates = [
        os.path.join(base_dir, "NextStep model"),
        os.path.join(os.path.dirname(base_dir), "NextStep model"),
        os.path.abspath("NextStep model"),
    ]
    model_dir = find_dir(model_candidates, "main.py")

    frontend_candidates = [
        os.path.join(base_dir, "NextStep Front+ backened"),
        base_dir,
        os.path.abspath("NextStep Front+ backened"),
    ]
    frontend_dir = find_dir(frontend_candidates, "server.js")

    # 1. Start Python AI Engine
    venv_py = r"C:\Users\absma\.venvs\NextStep\Scripts\python.exe"
    py_exec = venv_py if os.path.exists(venv_py) else sys.executable
    ai_cmd = [py_exec, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"]
    print(f"Starting Python AI Engine in {model_dir}...", flush=True)
    ai_proc = subprocess.Popen(ai_cmd, cwd=model_dir)
    print(f"NextStep AI Engine started (PID: {ai_proc.pid})", flush=True)

    # 2. Wait up to 15 seconds for AI Engine readiness
    for _ in range(15):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/ai/health", timeout=1) as resp:
                if resp.status == 200:
                    print("NextStep AI Engine is healthy and responding.", flush=True)
                    break
        except Exception:
            time.sleep(1)

    # 3. Start Node.js Web Server
    port = os.environ.get("PORT", "3000")
    print(f"Starting NextStep Web Server on port {port} in {frontend_dir}...", flush=True)
    node_cmd = ["node", "server.js"]
    node_proc = subprocess.Popen(node_cmd, cwd=frontend_dir)
    print(f"NextStep Web Server started (PID: {node_proc.pid})", flush=True)

    def shutdown(signum, frame):
        print("Shutting down NextStep services...", flush=True)
        try:
            ai_proc.terminate()
        except Exception:
            pass
        try:
            node_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    try:
        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)
    except Exception:
        pass

    # Monitor both processes
    while True:
        if ai_proc.poll() is not None:
            print(f"AI Engine exited with code {ai_proc.returncode}.", flush=True)
            try:
                node_proc.terminate()
            except Exception:
                pass
            sys.exit(ai_proc.returncode or 1)
        if node_proc.poll() is not None:
            print(f"Web Server exited with code {node_proc.returncode}.", flush=True)
            try:
                ai_proc.terminate()
            except Exception:
                pass
            sys.exit(node_proc.returncode or 1)
        time.sleep(1)

if __name__ == "__main__":
    main()
