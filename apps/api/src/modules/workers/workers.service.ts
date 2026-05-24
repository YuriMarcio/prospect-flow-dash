export async function getWorkerStatusService() {
  // Por enquanto retornamos um mock. 
  // No futuro, podemos ler se há instâncias do Playwright rodando.
  return {
    status: "online",
    active_jobs: 0,
    memory_usage: process.memoryUsage().heapUsed / 1024 / 1024 // em MB
  };
}