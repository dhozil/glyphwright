import { createClient, createAccount } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const CONTRACT = '0xe0d7385b9E15FF4b4EBFf7A15e293F290ecA0e29'
const PRIV_KEY = '0x499b5c7cf2e472fe929eaf7223366b5efa2cc1eafb2573ed30ff52144617fe4d'
const account = createAccount(PRIV_KEY)
const client = createClient({ chain: studionet, account })

const INTENTS = [
  'Freezes someone mid-sentence, words hanging as icicles',
  'Spilled wine becomes a loyal liquid serpent',
  'A note shatters glass and reforms it into a bird',
  'The caster\'s shadow acts out repressed emotions',
  'Ink bleeds off a page and rewrites as an insult',
  'A door mark lets the caster hear lies told behind it',
  'A braid charm for breathing underwater',
  'A locked chest plays a ballad about its contents',
  'Reflection moves three seconds ahead of the target',
  'A coin returns when spent in greed',
  'A lullaby through a keyhole creates a shared dream',
  'Trade voice to speak through a statue for an hour',
  'A handshake cipher encrypts the next words exchanged',
  'Ash blown at a hearth makes fire recall the last argument',
  'A finger thread feels the nearest emotional residue',
  'A whisper reignites an ember when a promise breaks',
  'Tears become a pearl holding the memory of that cry',
  'Tap a mirror to step through to the same room an hour ago',
  'A healing breath leaves a scar of the patient\'s fear',
  'A snap locks a door until a sincere secret is told',
]

async function main() {
  // Check existing
  const r = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const existing = JSON.parse(r || '[]')
  const existingIntents = new Set(existing.map(s => s.intent?.trim().toLowerCase()))
  console.log(`Existing: ${existing.length} spells (${existing.filter(s => s.consensus.verdict === 'FORGED').length} forged)\n`)

  // Forge only intents not yet forged by this account
  const toForge = INTENTS.filter(intent => !existingIntents.has(intent.toLowerCase()))
  console.log(`Need to forge: ${toForge.length} more\n`)

  if (toForge.length > 0) {
    console.log('=== Forging ===')
    for (const intent of toForge) {
      const hash = await client.writeContract({
        address: CONTRACT,
        functionName: 'forge_spell',
        args: [intent],
      })
      const tx = await client.waitForTransactionReceipt({
        hash,
        status: 2,
        retries: 600,
        interval: 3000,
      })
      const result = tx?.consensus_data?.leader_receipt?.[0]?.result
      let id = '?'
      if (result && typeof result === 'object' && result.payload?.readable) {
        try {
          const parsed = JSON.parse(result.payload.readable)
          const inner = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
          id = inner.spell_id
        } catch {}
      }
      console.log(`  ✓ ${id}: "${intent.slice(0, 40)}..."`)
    }
  }

  // List all forged spells
  const updated = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const spells = JSON.parse(updated || '[]')
  const forged = spells.filter(s => s.consensus.verdict === 'FORGED')
  console.log(`\n=== Listing ${forged.length} spells ===`)

  for (const s of forged) {
    const price = BigInt(3 + Math.floor(Math.random() * 28)) * 10n ** 18n
    try {
      const h = await client.writeContract({
        address: CONTRACT,
        functionName: 'list_spell',
        args: [s.id, price],
      })
      await client.waitForTransactionReceipt({
        hash: h,
        status: 2,
        retries: 600,
        interval: 2000,
      })
      console.log(`  ✓ ${s.id}: ${s.spellName} — ${price / 10n**18n} GEN`)
    } catch (e) {
      if ((e.message || '').includes('already listed')) {
        console.log(`  - ${s.id}: already listed`)
      } else {
        console.log(`  ✗ ${s.id}: ${e.message?.slice(0, 60)}`)
      }
    }
  }

  // Summary
  const listings = await client.readContract({
    address: CONTRACT,
    functionName: 'get_active_listings',
    args: [],
  })
  const active = JSON.parse(listings || '[]')
  console.log(`\n=== Market: ${active.length} listings ===`)
  for (const l of active) {
    const sp = l.spell || {}
    const votes = sp.votes || []
    const approved = votes.filter(v => v.approve).length
    const appr = votes.length ? Math.round((approved / votes.length) * 100) : 0
    console.log(`  ${l.id}: ${sp.spellName || '?'} — ${BigInt(l.price||'0') / 10n**18n} GEN (${appr}%)`)
  }
}

main().catch(e => console.error('FATAL:', e.message?.slice(0, 200)))
