import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto"
import { supabase } from "@/lib/supabase"

// Use environment variable for encryption key or generate a secure one
// In production, this should be a strong environment variable
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || 
  createHash('sha256').update(String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).digest('base64').substring(0, 32);

// Encrypt API key
function encryptApiKey(apiKey: string): { encryptedData: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex')
  };
}

// Decrypt API key
function decryptApiKey(encryptedData: string, iv: string): string {
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Store API key securely
export async function POST(req: NextRequest) {
  try {
    const { userId, apiKey } = await req.json();

    if (!userId || !apiKey) {
      return NextResponse.json({ success: false, error: "Missing userId or apiKey" }, { status: 400 });
    }

    // Encrypt the API key
    const { encryptedData, iv } = encryptApiKey(apiKey);

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({ 
          openai_api_key: encryptedData,
          openai_key_iv: iv,
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating API key:', error);
        return NextResponse.json({ success: false, error: "Failed to update API key" }, { status: 500 });
      }
    } else {
      // Create new profile
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          openai_api_key: encryptedData,
          openai_key_iv: iv,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating profile with API key:', error);
        return NextResponse.json({ success: false, error: "Failed to create profile" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception saving API key:', error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// Retrieve API key securely
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('openai_api_key, openai_key_iv')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // No rows found
        console.error('Error fetching API key:', error);
      }
      return NextResponse.json({ success: false, error: "API key not found" }, { status: 404 });
    }

    if (!data.openai_api_key || !data.openai_key_iv) {
      return NextResponse.json({ success: false, error: "API key not set" }, { status: 404 });
    }

    // Decrypt the API key
    const decryptedApiKey = decryptApiKey(data.openai_api_key, data.openai_key_iv);

    return NextResponse.json({ 
      success: true, 
      apiKey: decryptedApiKey 
    });
  } catch (error) {
    console.error('Exception retrieving API key:', error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
} 