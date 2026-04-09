type Job = {
  key: string;
  run: () => Promise<void>;
  retries: number;
};

const queue: Job[] = [];
let running = 0;
const MAX_CONCURRENT = 3;
const retryDelaysMs = [1500, 4000];

function scheduleNext() {
  if (running >= MAX_CONCURRENT) return;
  const next = queue.shift();
  if (!next) return;
  running++;
  void next
    .run()
    .catch(async () => {
      if (next.retries < retryDelaysMs.length) {
        const delay = retryDelaysMs[next.retries];
        await new Promise((resolve) => setTimeout(resolve, delay));
        queue.push({ ...next, retries: next.retries + 1 });
      }
    })
    .finally(() => {
      running--;
      scheduleNext();
    });
}

export function enqueueSyncJob(key: string, run: () => Promise<void>) {
  if (queue.some((j) => j.key === key)) return false;
  queue.push({ key, run, retries: 0 });
  scheduleNext();
  return true;
}
