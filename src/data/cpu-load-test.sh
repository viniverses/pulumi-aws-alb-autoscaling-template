#!/bin/bash
set -euo pipefail

# Generate a bounded CPU load on each available processor for an Auto Scaling test.
# Run on the two initial instances; the replacement or additional instances stay idle.
python3 - "$@" <<'PY'
import argparse
import multiprocessing
import os
import time

parser = argparse.ArgumentParser(description="Generate temporary CPU load for the ASG template.")
parser.add_argument("--seconds", type=int, default=600)
parser.add_argument("--percent", type=int, default=75)
args = parser.parse_args()
if not 1 <= args.seconds <= 1800:
    parser.error("--seconds must be between 1 and 1800")
if not 1 <= args.percent <= 100:
    parser.error("--percent must be between 1 and 100")


def load_cpu(end, percent):
    cycle = 0.1
    while time.monotonic() < end:
        started = time.monotonic()
        busy_until = min(started + cycle * percent / 100, end)
        while time.monotonic() < busy_until:
            pass
        time.sleep(max(0, min(started + cycle, end) - time.monotonic()))


workers = len(os.sched_getaffinity(0))
end = time.monotonic() + args.seconds
processes = []
print(f"Targeting {args.percent}% CPU on {workers} processor(s) for {args.seconds} seconds.", flush=True)
try:
    for _ in range(workers):
        process = multiprocessing.Process(target=load_cpu, args=(end, args.percent))
        process.start()
        processes.append(process)
    for process in processes:
        process.join()
finally:
    for process in processes:
        if process.is_alive():
            process.terminate()
        process.join()
print("CPU load test finished.", flush=True)
PY
