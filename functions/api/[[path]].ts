export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);

  // Proxy /api/* hacia Railway
  const target = new URL(
    'https://invigorating-reverence-production.up.railway.app' +
    url.pathname + url.search
  );

  const upstreamReq = new Request(target.toString(), request);
  const headers = new Headers(upstreamReq.headers);
  headers.delete('accept-encoding'); // opcional
  const resp = await fetch(upstreamReq, { headers });

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}
