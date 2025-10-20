import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch or create venues by name (avoid onConflict on non-unique column)
    const getOrCreateVenue = async (name: string, address: string, timezone: string) => {
      const { data: existing, error: selErr } = await supabaseClient
        .from('venues')
        .select('*')
        .ilike('name', name)
        .maybeSingle()

      if (selErr) throw selErr
      if (existing) return existing

      const { data: created, error: insErr } = await supabaseClient
        .from('venues')
        .insert([{ name, address, timezone, is_active: true }])
        .select()
        .single()

      if (insErr) throw insErr
      return created
    }

    const melbourneVenue = await getOrCreateVenue('Melbourne', 'Melbourne CBD, Victoria', 'Australia/Melbourne')
    const sydneyVenue = await getOrCreateVenue('Sydney', 'Sydney CBD, NSW', 'Australia/Sydney')

    const melbourneId = melbourneVenue.id
    const sydneyId = sydneyVenue.id

    // Melbourne signage spots
    const melbourneSpots = [
      {
        venue_id: melbourneId,
        location_name: 'Inside venue floor facing towards outside Cal Lane',
        width_cm: 126,
        height_cm: 200,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'high',
        status: 'empty',
        notes: 'Quote [Hana], Design Brief [Beth]',
        creative_brief: 'Consider making this a highly aesthetic window display (w/ sponsors?)',
        recommendations: 'First Run priority signage',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1xNBjP4EODu0BtaelN4efZQaoOfz2zHhQ?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Inside venue wall facing towards outside Cal Lane',
        width_cm: 480,
        height_cm: 168,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'high',
        status: 'empty',
        notes: 'Quote, Design. Comprised of 2 x individual panels 2.4m W',
        creative_brief: 'Consider making this a highly aesthetic window display (w/ sponsors?) akin to Myer christmas display; or Hozier Lane/ACDC Lane',
        recommendations: 'Short-term, just change the sign',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1xNBjP4EODu0BtaelN4efZQaoOfz2zHhQ?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Alienware Arena lightbox',
        width_cm: 200,
        height_cm: 300,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'high',
        status: 'empty',
        notes: '1. Quote 2. Brief Design 3. Design',
        creative_brief: 'Needs to Pop and standout. "Welcome Banner" Welcome to the HOME OF GAMES. Icons not photos. Dungeons & Flagons, Mana on Tap, Arcade Gaming, Board Games, Trivia, Gaming Expo After Parties, Gaming Tournaments, Watch Parties, PC Gaming Leaderboards, Hero Console Booths, Streaming Pods, Parties, Functions and More',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1E_d8h5zeIbk9g3KOXwDwLVN2kzciZynC?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch beside Alienware Arena doors entrance',
        width_cm: 74,
        height_cm: 350,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: '1. Quote so we can consider how often we update 2. Brief Design',
        creative_brief: 'These signs could be CTAs instead of just informative. QR codes that lead to socials. Find out more drivers. A way to catch the "this looks cool but we don\'t have time to stop" crowd.',
        recommendations: 'Replace with a signage solution that can be swapped in and out (as the current one is fitted into the wall). The current sign is made of a taught fabric - suggest we swap to thin plastic that sits on top of the frame',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1R1vK7v9G4mzbcpnogk_u4AYtmRiSkpOr?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch front panel',
        width_cm: 60,
        height_cm: 200,
        content_category: 'theming',
        supplier_vendor: 'Signage',
        priority_level: 'medium',
        status: 'empty',
        notes: '1. Research Signage Solution 2. Brief design',
        creative_brief: 'These signs could be CTAs instead of just informative. QR codes that lead to socials.',
        recommendations: 'Replace with a signage solution that can be swapped in and out. Keep it as thin plastic (it slots in and out)',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1R1vK7v9G4mzbcpnogk_u4AYtmRiSkpOr?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch side panel (outer)',
        width_cm: 85,
        height_cm: 200,
        content_category: 'theming',
        supplier_vendor: 'Signage',
        priority_level: 'medium',
        status: 'empty',
        notes: '1. Research Signage Solution 2. Senpais to design',
        recommendations: 'Replace with a signage solution that can be swapped in and out. Keep it as thin plastic (it sits on top of the frame)',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1R1vK7v9G4mzbcpnogk_u4AYtmRiSkpOr?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch back panel',
        width_cm: 60,
        height_cm: 200,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        notes: 'Currently there is nothing there and the front panel is double-sided',
        recommendations: 'Consider boxing it in with another panel (optional)',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1R1vK7v9G4mzbcpnogk_u4AYtmRiSkpOr?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch side panel (inner)',
        width_cm: 85,
        height_cm: 200,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        recommendations: 'Replace with a signage solution that can be swapped in and out. Keep it as thin plastic (it sits on top of the frame)',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1R1vK7v9G4mzbcpnogk_u4AYtmRiSkpOr?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Retail merch poster behind reception counter',
        width_cm: 83,
        height_cm: 120,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: '1. Senpais Design for our JV Merch',
        creative_brief: 'Replace with character art - Marketing-esque',
        recommendations: 'Replace with new artwork - ideally evergreen. A0 size (0.83m W x 1.2m H inc. frame)'
      },
      {
        venue_id: melbourneId,
        location_name: 'Alienware Arena wall (next to lightbox)',
        width_cm: 330,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Use Character Lore Designs',
        creative_brief: 'Mon: Trivia, Tue: Curry Night, Wed: Board Game Social, Fri: Mana on Tap, Sun: Dungeons & Flagons. It would be great to see this as an instagramable moment. Aesthetic character / venue lore with soft branding (crest) in a more edgy design. Manipulate lighting for great shots.',
        recommendations: 'Consider putting a permanent aesthetic wall decal.'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs female bathroom wall (between toilets and sinks)',
        width_cm: 176,
        height_cm: 267,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        notes: 'Character Lore - need to cut out a section for the maintenance box',
        creative_brief: 'The big mural wall outside in Sydney would be amazing inspiration. Flowing invitations into our lore. Theme each bathroom differently with signature scent.',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs female bathroom wall (small separator)',
        width_cm: 103,
        height_cm: 267,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        notes: 'Quote and depending on cost consider as marketing',
        creative_brief: 'Either go mirrors or walls. If mirrors, play into the "bathroom selfie" trend in gaming audiences.',
        recommendations: 'Consider putting a permanent aesthetic wall decal - Theming'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs female bathroom wall (opposite toilets)',
        width_cm: 380,
        height_cm: 267,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        notes: 'Quote and depending on cost consider as marketing',
        creative_brief: 'Bathroom theming with signature scent to create core memories',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs male bathroom wall (above urinals)',
        width_cm: 400,
        height_cm: 177,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        notes: 'Stickers?',
        creative_brief: 'Could it be fun to do something engaging here and be really playful? Puzzles? quotes to read? A Fortress history wall?',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs male bathroom divider wall (behind urinals)',
        width_cm: 258,
        height_cm: 268,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'low',
        status: 'empty',
        creative_brief: 'Bathroom theming with signature scent',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs male bathroom back wall (next to sinks)',
        width_cm: 288,
        height_cm: 268,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Quote and depending on cost. Could this be What\'s On ... Trivia Monday, Board Game Social Weds, Mana on Tap Friday',
        creative_brief: 'A cool black and white design around an A1 poster frame where we change out the poster',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs male hallway to bathroom side wall (1 of 2)',
        width_cm: 148,
        height_cm: 268,
        content_category: 'marketing',
        priority_level: 'low',
        status: 'empty',
        creative_brief: 'Promotional wall with evergreen content. Can we use it as a CTA - QR code as an easter egg or a driver to another space in venue.',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Upstairs male hallway to bathroom side wall (2 of 2)',
        width_cm: 148,
        height_cm: 268,
        content_category: 'marketing',
        priority_level: 'low',
        status: 'empty',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Top of staircase towards Cal Lane exit',
        width_cm: 230,
        height_cm: 299,
        content_category: 'marketing',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Character Lore - Home of Games',
        creative_brief: 'Take inspiration from In Game maps and use that for Wayfinding. "locations" for each area of venue Tavern, LAN, Retail, 2315, Mezz and Arcade',
        recommendations: 'Consider removing the signage & putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Cal Lane entrance (left of door when entering from outside)',
        width_cm: 36,
        height_cm: 116,
        content_category: 'theming',
        priority_level: 'high',
        status: 'empty',
        recommendations: 'Refresh this graphic and/or make the message clearer',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1xNBjP4EODu0BtaelN4efZQaoOfz2zHhQ?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Cal Lane entrance short window (right of door)',
        width_cm: 70,
        height_cm: 300,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'high',
        status: 'empty',
        notes: 'Quote, Design',
        recommendations: 'Refresh this graphic and/or make the message clearer',
        legacy_drive_link: 'https://drive.google.com/drive/folders/1xNBjP4EODu0BtaelN4efZQaoOfz2zHhQ?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Cal Lane entrance wide window (right of door)',
        width_cm: 127,
        height_cm: 300,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'high',
        status: 'empty',
        creative_brief: 'Make it clear this is an entryway with a "bar" focus. Let people know there is a cool laneway bar here.',
        recommendations: 'Consider making a graphic with a clear message (be careful not to block the inner sign)'
      },
      {
        venue_id: melbourneId,
        location_name: 'Tavern escalator landing towards kitchen',
        width_cm: 280,
        height_cm: 232,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Character Lore',
        creative_brief: 'Hand-drawn blackboard for specials/what\'s on, or merch display. This is prime real estate for a CTA.',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Tavern escalator landing towards Tavern',
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        notes: 'I think this would be good "white space"',
        recommendations: 'Consider putting a permanent easel'
      },
      {
        venue_id: melbourneId,
        location_name: 'Tavern bathroom hallway (back wall)',
        width_cm: 166,
        height_cm: 238,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Arcade window wall',
        width_cm: 290,
        height_cm: 200,
        content_category: 'marketing',
        priority_level: 'medium',
        status: 'empty',
        creative_brief: 'Great for an arcade CTA. Scan the QR code to see our current deals and upcoming arcade events.',
        recommendations: 'Consider putting a permanent aesthetic wall decal'
      },
      {
        venue_id: melbourneId,
        location_name: 'Tavern bar overhead panel (half)',
        width_cm: 140,
        height_cm: 42,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Quote and then we can decide frequency. Measured inside the frame',
        recommendations: 'Consider putting a permanent aesthetic signage thin plastic'
      },
      {
        venue_id: melbourneId,
        location_name: 'LAN/Streamer Pods - Sound Absorber Wall 1',
        width_cm: 270,
        height_cm: 298,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Looking for affordable sound absorbers',
        recommendations: 'Adding foam padding for audio improvement and signage to cover the hole'
      },
      {
        venue_id: melbourneId,
        location_name: 'LAN/Streamer Pods - Character Wall',
        width_cm: 223,
        height_cm: 298,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty',
        notes: 'In talks with senpai about the costs to get some decals printed',
        creative_brief: 'Avoid any characterisation or branding on the wall that shows on camera. Ways to help streamers temporarily personalise.',
        recommendations: 'Remove redbull decal and shelf, then add fortress theming that\'s not too in your face. Character sticker decals'
      },
      {
        venue_id: melbourneId,
        location_name: 'LAN/Streamer Pods - Carina Wall',
        width_cm: 382,
        height_cm: 298,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: 'Looking for affordable sound absorbers. $300 quotes by Hana for a decal vinyl sticker',
        recommendations: 'Adding foam padding for audio improvement',
        legacy_drive_link: 'https://drive.google.com/file/d/1oBzN42xXNiwop0c59waMVApD3Dzaw7D0/view?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'LAN/Streamer Pods - Jim Wall',
        width_cm: 199,
        height_cm: 298,
        content_category: 'theming',
        supplier_vendor: 'Senpais',
        priority_level: 'medium',
        status: 'empty',
        notes: 'In talks with senpai. $300 quotes by Hana for a decal vinyl sticker',
        creative_brief: 'Avoid branding on camera walls. Help streamers personalise temporarily.',
        recommendations: 'Remove redbull decal then add fortress theming. Character sticker decals',
        legacy_drive_link: 'https://drive.google.com/file/d/1f_SZ3JuB1dEg3dpnOS-jVH90ffvRdinT/view?usp=sharing'
      },
      {
        venue_id: melbourneId,
        location_name: 'Left pillar of merch',
        width_cm: 146,
        height_cm: 155,
        content_category: 'marketing',
        priority_level: 'medium',
        status: 'empty',
        creative_brief: 'Take inspiration from In Game maps and use for Wayfinding. "locations" for Tavern, LAN, Retail, 2315, Mezz and Arcade with highlight art',
        recommendations: 'Instagramable moment with venue map'
      },
      {
        venue_id: melbourneId,
        location_name: 'Pillar to the right of arena entry',
        width_cm: 130,
        height_cm: 142.5,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        creative_brief: 'Leave this blank as white space can be as important. This is retail space now for pricing/retail drivers.',
        recommendations: 'Lower priority - focus on other walls first. Big character drop maybe?'
      },
      {
        venue_id: melbourneId,
        location_name: 'Halfway platform of the stairwell',
        width_cm: 136,
        height_cm: 296,
        content_category: 'marketing',
        priority_level: 'high',
        status: 'empty',
        creative_brief: 'Creative that "beckons" people upstairs. Combination of intriguing world lore art with CTA. Use creative psychology - imagery sweeping upwards. Art that wraps around stairs from bottom to top',
        recommendations: 'High priority wayfinding art'
      },
      {
        venue_id: melbourneId,
        location_name: 'Above the stairwell',
        width_cm: 153,
        height_cm: 190.5,
        content_category: 'marketing',
        priority_level: 'high',
        status: 'empty',
        creative_brief: 'Great place for 2315 branded art as extension to entryway. Driver to enter the bar. Some kind of rebellion call to action or reference to "Green Mist" lore',
        recommendations: '2315 branding opportunity'
      },
      {
        venue_id: melbourneId,
        location_name: 'Pillar in Mezzanine x2 (4 sides)',
        width_cm: 131,
        height_cm: 332,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty'
      },
      {
        venue_id: melbourneId,
        location_name: 'Pillar in Mezzanine near arcade',
        width_cm: 89.2,
        height_cm: 297,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty'
      }
    ]

    // Sydney signage spots
    const sydneySpots = [
      {
        venue_id: sydneyId,
        location_name: 'Left pillar of merch',
        width_cm: 146,
        height_cm: 155,
        content_category: 'marketing',
        priority_level: 'medium',
        status: 'empty',
        creative_brief: 'It would be really cool to take inspiration from In Game maps and use that for Wayfinding in the venue (but also an awesome instagramable moment for engagement). We would have "locations" for each area of the venue Tavern, LAN, Retail, 2315, Mezz and Arcade with some highlight art for each to make people curious. Some cool tavern graphics with a arrow and same for the arcade to compliment the signage that\'s there',
        recommendations: 'In-game map wayfinding concept'
      },
      {
        venue_id: sydneyId,
        location_name: 'Pillar to the right of arena entry',
        width_cm: 130,
        height_cm: 142.5,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        creative_brief: 'This is an opportunity but I would actually leave this blank as white space can be as important as character so the other walls pop. This is also a "retail space now" and we will be implementing for pricing / retail drivers. Big ol character drop maybe?',
        recommendations: 'Lower priority - consider white space, possibly large character art'
      },
      {
        venue_id: sydneyId,
        location_name: 'Halfway platform of the stairwell',
        width_cm: 136,
        height_cm: 296,
        content_category: 'marketing',
        priority_level: 'high',
        status: 'empty',
        creative_brief: 'It would be great to have creative here that "beckons" people upstairs. A combination of intriguing world based lore art but also a call to action of some kind that hints that what waits upstairs is worth exploring. This could tie into the teasers on the world map wayfinding downstairs. Look at creative psychology - lots of imagery sweeping upwards then outwards at the top, or artwork that wraps around the stairs from bottom to top',
        recommendations: 'High priority - wayfinding with upward motion design'
      },
      {
        venue_id: sydneyId,
        location_name: 'Above the stairwell',
        width_cm: 153,
        height_cm: 190.5,
        content_category: 'marketing',
        priority_level: 'high',
        status: 'empty',
        creative_brief: 'This would be a great place for 2315 branded art as an extension to the entryway. A driver to enter the bar before they even get to the top of the stairs. Some kind of rebellion call to action or reference to the "Green Mist" lore',
        recommendations: '2315 branding - rebellion theme'
      },
      {
        venue_id: sydneyId,
        location_name: 'Pillar in Mezzanine x2 (4 sides)',
        width_cm: 131,
        height_cm: 332,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty'
      },
      {
        venue_id: sydneyId,
        location_name: 'Pillar in Mezzanine near arcade',
        width_cm: 89.2,
        height_cm: 297,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty'
      },
      {
        venue_id: sydneyId,
        location_name: 'Male/Female Bathrooms Mirrors x 8',
        width_cm: 45,
        height_cm: 90,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        notes: '8 mirrors total across male and female bathrooms'
      },
      {
        venue_id: sydneyId,
        location_name: 'Downstairs female bathroom in between mirrors',
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        notes: 'Measurements in photo'
      },
      {
        venue_id: sydneyId,
        location_name: 'Unisex Bathrooms Mirrors x 5',
        width_cm: 60,
        height_cm: 95,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty',
        notes: '5 mirrors total across unisex bathrooms'
      },
      {
        venue_id: sydneyId,
        location_name: 'Downstairs female bathroom wall',
        width_cm: 193.5,
        height_cm: 144.5,
        content_category: 'theming',
        priority_level: 'medium',
        status: 'empty'
      },
      {
        venue_id: sydneyId,
        location_name: 'Downstairs Female floor to ceiling mirror',
        width_cm: 60,
        height_cm: 180,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty'
      },
      {
        venue_id: sydneyId,
        location_name: 'Female bathroom 2315',
        width_cm: 40,
        height_cm: 90,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty'
      },
      {
        venue_id: sydneyId,
        location_name: 'Female Bathroom 2315 - Large Wall',
        width_cm: 80,
        height_cm: 189,
        content_category: 'theming',
        priority_level: 'low',
        status: 'empty'
      }
    ]

    // Combine all signage spots
    const allSignageSpots = [...melbourneSpots, ...sydneySpots]

    // Insert all signage spots
    const { error: spotsError } = await supabaseClient
      .from('signage_spots')
      .insert(allSignageSpots)

    if (spotsError) throw spotsError

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${melbourneSpots.length} Melbourne spots and ${sydneySpots.length} Sydney spots (${allSignageSpots.length} total)`,
        venues: { melbourne: melbourneId, sydney: sydneyId }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Import error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
