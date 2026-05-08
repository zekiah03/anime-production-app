'use client'

import { createClient } from '@supabase/supabase-js'

// 個人利用想定のため、publishable key を直書き(本来は公開して良い設計)。
// RLS は anime テーブルで disable 済み + Storage は anime-assets を public に。
const SUPABASE_URL = 'https://pvhfkralqcbwfknzpmql.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jmqhHezSIUvD-YP2QJXdZQ_UjV5Nfj4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

export const STORAGE_BUCKET = 'anime-assets'
