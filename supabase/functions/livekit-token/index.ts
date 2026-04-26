import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TokenRequest = {
  classId?: number;
  lessonNumber?: number;
};

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64Url(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  const apiKey = Deno.env.get('LIVEKIT_API_KEY');
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization') ?? '';

  if (!livekitUrl || !apiKey || !apiSecret || !supabaseUrl || !supabaseAnonKey || !authorization) {
    return new Response(JSON.stringify({ error: 'Video service is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as TokenRequest;
  const classId = Number(body.classId);
  const lessonNumber = Number(body.lessonNumber);

  if (!Number.isInteger(classId) || !Number.isInteger(lessonNumber)) {
    return new Response(JSON.stringify({ error: 'Missing class or lesson.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: hasAccess, error: accessError } = await supabase.rpc('classroom_has_access', {
    p_class_id: classId,
  });

  if (accessError || !hasAccess) {
    return new Response(JSON.stringify({ error: 'You do not have access to this classroom.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: appUserId, error: appUserError } = await supabase.rpc('current_app_user_id');
  if (appUserError || typeof appUserId !== 'number') {
    return new Response(JSON.stringify({ error: 'Could not resolve classroom user.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('display_name, email')
    .eq('id', appUserId)
    .maybeSingle();

  const identity = `app-user-${appUserId}`;
  const name = appUser?.display_name?.trim() || appUser?.email?.split('@')[0] || identity;
  const room = `classroom-${classId}-lesson-${lessonNumber}`;
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    {
      iss: apiKey,
      sub: identity,
      name,
      nbf: now - 10,
      exp: now + 60 * 60,
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    },
    apiSecret,
  );

  return new Response(JSON.stringify({ url: livekitUrl, token, identity, room }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
