import timeit
import secrets
import random
import statistics

SECRET = "oms_wms_internal_api_key_secret_2026"
len_secret = len(SECRET)

case_diff_start = "x" * len_secret
case_diff_end = SECRET[:-1] + "x"
case_exact = SECRET
case_diff_len = "x" * 5

def test_eq_diff_start():
    return SECRET == case_diff_start

def test_eq_diff_end():
    return SECRET == case_diff_end

def test_eq_exact():
    return SECRET == case_exact

def test_eq_diff_len():
    return SECRET == case_diff_len

def test_digest_diff_start():
    return secrets.compare_digest(SECRET, case_diff_start)

def test_digest_diff_end():
    return secrets.compare_digest(SECRET, case_diff_end)

def test_digest_exact():
    return secrets.compare_digest(SECRET, case_exact)

def test_digest_diff_len():
    return secrets.compare_digest(SECRET, case_diff_len)

def run_benchmarks():
    iterations = 1_000_000
    trials = 10
    
    # Define tasks
    tasks = {
        "eq_diff_start": test_eq_diff_start,
        "eq_diff_end": test_eq_diff_end,
        "eq_exact": test_eq_exact,
        "eq_diff_len": test_eq_diff_len,
        "digest_diff_start": test_digest_diff_start,
        "digest_diff_end": test_digest_diff_end,
        "digest_exact": test_digest_exact,
        "digest_diff_len": test_digest_diff_len,
    }
    
    # Warmup
    print("Warming up CPU...")
    for _ in range(3):
        for name, func in tasks.items():
            timeit.timeit(func, number=100_000)
            
    # Run trials
    results = {name: [] for name in tasks}
    
    print(f"Running {trials} randomized trials, {iterations:,} iterations each...")
    for trial in range(trials):
        keys = list(tasks.keys())
        random.shuffle(keys)
        for name in keys:
            t = timeit.timeit(tasks[name], number=iterations)
            results[name].append(t)
            
    # Print results
    print("\n--- Benchmark Results (seconds) ---")
    for name, times in sorted(results.items()):
        mean_val = statistics.mean(times)
        stdev_val = statistics.stdev(times)
        print(f"{name:18} | Mean: {mean_val:.6f}s | Stdev: {stdev_val:.6f}s")
        
    # Standard == comparison analysis
    eq_start_mean = statistics.mean(results["eq_diff_start"])
    eq_end_mean = statistics.mean(results["eq_diff_end"])
    eq_exact_mean = statistics.mean(results["eq_exact"])
    eq_diff_len_mean = statistics.mean(results["eq_diff_len"])
    
    print("\n--- Standard Equality (==) Analysis ---")
    print(f"Early exit (diff at 0):  {eq_start_mean:.6f}s")
    print(f"Late exit (diff at 35):  {eq_end_mean:.6f}s")
    print(f"Exact match:             {eq_exact_mean:.6f}s")
    print(f"Length mismatch:         {eq_diff_len_mean:.6f}s")
    eq_diff_pct = (eq_end_mean - eq_start_mean) / eq_start_mean * 100
    print(f"Timing difference (diff at 0 vs diff at 35): {eq_diff_pct:+.2f}%")
    
    # secrets.compare_digest analysis
    dig_start_mean = statistics.mean(results["digest_diff_start"])
    dig_end_mean = statistics.mean(results["digest_diff_end"])
    dig_exact_mean = statistics.mean(results["digest_exact"])
    dig_diff_len_mean = statistics.mean(results["digest_diff_len"])
    
    print("\n--- secrets.compare_digest Analysis ---")
    print(f"Diff at 0:               {dig_start_mean:.6f}s")
    print(f"Diff at 35:              {dig_end_mean:.6f}s")
    print(f"Exact match:             {dig_exact_mean:.6f}s")
    print(f"Length mismatch:         {dig_diff_len_mean:.6f}s")
    dig_diff_pct = (dig_end_mean - dig_start_mean) / dig_start_mean * 100
    print(f"Timing difference (diff at 0 vs diff at 35): {dig_diff_pct:+.2f}%")
    
    # Compare early-exit difference vs constant-time difference
    print("\n--- Conclusion ---")
    print(f"Standard == timing delta (start vs end diff): {abs(eq_end_mean - eq_start_mean) * 1e9 / iterations:.2f} ns per iteration")
    print(f"compare_digest timing delta (start vs end diff): {abs(dig_end_mean - dig_start_mean) * 1e9 / iterations:.2f} ns per iteration")

if __name__ == "__main__":
    run_benchmarks()
