import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://prep2place-backend.onrender.com"
).replace(/\/+$/, "");

async function handleProxy(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const targetPath = (params.path || []).join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/api/${targetPath}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    const k = key.toLowerCase();
    // Strip host, origin, referer and content-length so backend sees server-side call without CORS triggers
    if (
      k !== "host" &&
      k !== "origin" &&
      k !== "referer" &&
      k !== "content-length" &&
      k !== "connection"
    ) {
      headers.set(key, val);
    }
  });

  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const options: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const body = await req.arrayBuffer();
      if (body.byteLength > 0) {
        options.body = body;
      }
    } catch {
      // no body
    }
  }

  try {
    const backendRes = await fetch(targetUrl, options);
    const resBody = await backendRes.arrayBuffer();

    const responseHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      const k = key.toLowerCase();
      if (k !== "content-encoding" && k !== "transfer-encoding") {
        responseHeaders.set(key, val);
      }
    });

    return new NextResponse(resBody, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Backend service unreachable",
        message: err?.message || String(err),
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
