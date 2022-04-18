addEventListener("fetch", (event) => {
  event.respondWith(
    handleRequest(event.request).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  );
});

const PRESHARED_AUTH_HEADER_KEY = "X-Custom-PSK";
const PRESHARED_AUTH_HEADER_VALUE = "sfiejhr9p8quw";

async function handleRequest(request) {
  const { url, headers } = request;
  const psk = headers.get(PRESHARED_AUTH_HEADER_KEY);
  const token = (await PROXY.get('token')) || PRESHARED_AUTH_HEADER_VALUE;

  if (psk !== token) {
    return new Response("", {
      status: 403,
    });
  }

  const { pathname } = new URL(url);
  const raw = pathname.replace(/-/g, "+").replace(/_/g, "/").slice(1);

  try {
    new URL(atob(raw));
  } catch (e) {
    return new Response(e, { status: 400 });
  }

  const tmp = atob(raw);

  const req = {
    ...request,
    url: tmp,
  };

  return fetch(new Request(tmp, req));
}
