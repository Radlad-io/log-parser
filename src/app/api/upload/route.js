import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      console.log('No file received in request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Log file details for debugging
    console.log('Received file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (!file.name.endsWith('.LOG')) {
      return NextResponse.json(
        { error: 'Only .LOG files are allowed' },
        { status: 400 }
      );
    }

    // Check if file already exists in the log files directory
    const { blobs } = await list({ prefix: 'log files/' });
    const existingFile = blobs.find(blob => blob.pathname === `log files/${file.name}`);

    if (existingFile) {
      return NextResponse.json({ 
        url: existingFile.url,
        exists: true 
      });
    }

    // Upload to the log files directory
    const blob = await put(`log files/${file.name}`, file, {
      access: 'public',
      contentType: 'text/plain'
    });

    return NextResponse.json({ 
      url: blob.url,
      exists: false 
    });
  } catch (error) {
    console.error('Detailed upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Error uploading file' },
      { status: 500 }
    );
  }
} 