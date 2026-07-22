import {
  handleVehicleRegistrationLookup,
  type PlateApiProxyEnv,
} from '../functions/api/vehicle-registration-lookup';

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnv extends PlateApiProxyEnv {
  readonly ASSETS: AssetFetcher;
}

interface WorkerHandler<Env> {
  fetch(request: Request, env: Env): Promise<Response>;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/vehicle-registration-lookup') {
      return handleVehicleRegistrationLookup(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies WorkerHandler<WorkerEnv>;
