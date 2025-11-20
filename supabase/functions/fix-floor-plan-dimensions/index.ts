/**
 * Edge Function to fix missing floor plan dimensions
 *
 * This function:
 * 1. Finds all floor plans with missing dimensions
 * 2. Fetches each image from storage
 * 3. Detects the actual image dimensions
 * 4. Updates the database with correct dimensions
 *
 * Usage: POST to this function endpoint (one-time fix)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all floor plans
    const { data: floorPlans, error: fetchError } = await supabase
      .from('floor_plans')
      .select('*')
      .or('original_width.is.null,original_height.is.null')

    if (fetchError) {
      throw fetchError
    }

    if (!floorPlans || floorPlans.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'All floor plans already have dimensions set',
          updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const plan of floorPlans) {
      try {
        console.log(`Processing floor plan: ${plan.display_name} (${plan.id})`)

        // Fetch the image
        const imageResponse = await fetch(plan.image_url)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
        }

        const imageBlob = await imageResponse.blob()
        const arrayBuffer = await imageBlob.arrayBuffer()

        // Detect image dimensions based on image type
        const dimensions = await getImageDimensions(new Uint8Array(arrayBuffer))

        if (!dimensions) {
          throw new Error('Could not detect image dimensions')
        }

        // Update the database
        const { error: updateError } = await supabase
          .from('floor_plans')
          .update({
            original_width: dimensions.width,
            original_height: dimensions.height,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id)

        if (updateError) {
          throw updateError
        }

        results.push({
          id: plan.id,
          display_name: plan.display_name,
          width: dimensions.width,
          height: dimensions.height,
          status: 'success'
        })

        console.log(`✓ Updated ${plan.display_name}: ${dimensions.width}x${dimensions.height}`)
      } catch (error) {
        console.error(`✗ Error processing ${plan.display_name}:`, error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          id: plan.id,
          display_name: plan.display_name,
          status: 'error',
          error: errorMessage
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} floor plans`,
        results,
        updated: results.filter(r => r.status === 'success').length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Extract image dimensions from image data
 * Supports PNG, JPEG, GIF, WebP
 */
function getImageDimensions(data: Uint8Array): { width: number; height: number } | null {
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return {
      width: (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19],
      height: (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]
    }
  }

  // JPEG
  if (data[0] === 0xFF && data[1] === 0xD8) {
    let offset = 2
    while (offset < data.length) {
      if (data[offset] !== 0xFF) break

      const marker = data[offset + 1]

      // Start of Frame markers
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return {
          height: (data[offset + 5] << 8) | data[offset + 6],
          width: (data[offset + 7] << 8) | data[offset + 8]
        }
      }

      offset += 2 + ((data[offset + 2] << 8) | data[offset + 3])
    }
  }

  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return {
      width: data[6] | (data[7] << 8),
      height: data[8] | (data[9] << 8)
    }
  }

  // WebP
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    if (data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      // VP8
      if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
        return {
          width: ((data[26] | (data[27] << 8)) & 0x3fff),
          height: ((data[28] | (data[29] << 8)) & 0x3fff)
        }
      }
      // VP8L
      if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4C) {
        const bits = (data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24)) >>> 0
        return {
          width: (bits & 0x3FFF) + 1,
          height: ((bits >> 14) & 0x3FFF) + 1
        }
      }
    }
  }

  return null
}
