import { createClient, createAccount } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const CONTRACT = '0xe0d7385b9E15FF4b4EBFf7A15e293F290ecA0e29'
const PRIV_KEY = '0x499b5c7cf2e472fe929eaf7223366b5efa2cc1eafb2573ed30ff52144617fe4d'
const account = createAccount(PRIV_KEY)
const client = createClient({ chain: studionet, account })

const INTENTS = [
  'A spell that freezes someone mid-sentence, their words hanging frozen as icicles in the air',
  'A spell that turns spilled wine into a loyal liquid serpent that follows one command',
  'A single sung note that shatters all glass within earshot, then reforms it into a shimmering bird',
  'A reversed incantation that makes the caster\'s shadow act out their repressed emotions for all to see',
  'A quick gesture making ink bleed off a page and rewrite the sentence as an insult in the author\'s hand',
  'A mark traced on a door that lets the caster hear every lie told behind it for one day',
  'A charm woven into a braid that lets the wearer breathe underwater for one hour per strand',
  'An enchantment that makes a locked chest play a mournful ballad about whatever is inside it',
  'A hex that causes the target\'s reflection to be three seconds ahead of their actual movements',
  'A sigil burned into a coin that returns to the caster\'s pocket whenever spent in greed',
  'A lullaby hummed through a keyhole that puts all occupants into a single shared dream',
  'A ritual trading the caster\'s voice for an hour to speak through the mouth of a nearby statue',
  'A syllabic cipher woven into a handshake that encrypts the next words exchanged between the pair',
  'A pinch of ash blown toward a hearth that makes the fire recount the last argument it witnessed',
  'A thread tied around a finger that lets the caster feel the nearest significant emotional residue',
  'A whisper to a dying ember that reignites only when a promise is about to be broken nearby',
  'A three-note whistle that makes shed tears coalesce into a pearl holding the memory of that cry',
  'A tap on a mirror that lets the caster step through to the exact same room as one hour ago',
  'A breath exhaled over a wound that accelerates healing but leaves a scar of the patient\'s fear',
  'A melodic snap that locks the last door touched and only unlocks when a sincere secret is told',
]

async function main() {
  // 1. Submit all 20 forges at once (fire & collect hashes)
  console.log('=== Submitting 20 forges ===')
  const hashes = []
  for (const intent of INTENTS) {
    const hash = await client.writeContract({
      address: CONTRACT,
      functionName: 'forge_spell',
      args: [intent],
    })
    console.log(`  ${hash.slice(0, 18)}... | "${intent.slice(0, 55)}..."`)
    hashes.push(hash)
  }

  // 2. Wait for each in sequence with very long timeout
  console.log('\n=== Waiting for forges to be accepted ===')
  for (const h of hashes) {
    try {
      const tx = await client.waitForTransactionReceipt({
        hash: h,
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
      console.log(`  ✓ ${h.slice(0, 18)}... → ${id}`)
    } catch {
      console.log(`  … ${h.slice(0, 18)}... (still processing)`)
    }
  }

  // 3. Check what we got
  const r = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const spells = JSON.parse(r || '[]')
  const forged = spells.filter(s => s.consensus.verdict === 'FORGED')
  console.log(`\nForged: ${forged.length}/${spells.length}`)

  // 4. List all forged spells
  console.log('\n=== Listing spells ===')
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
      const m = (e.message || '').slice(0, 80)
      if (m.includes('already listed')) console.log(`  - ${s.id}: already listed`)
      else console.log(`  ✗ ${s.id}: ${m}`)
    }
  }

  // 5. Final market summary
  const listings = await client.readContract({
    address: CONTRACT,
    functionName: 'get_active_listings',
    args: [],
  })
  const active = JSON.parse(listings || '[]')
  console.log(`\n=== Market: ${active.length} listings ===`)
  let total = 0n
  for (const l of active) {
    const p = BigInt(l.price || '0')
    total += p
    const sp = l.spell || {}
    const votes = sp.votes || []
    const approved = votes.filter(v => v.approve).length
    const appr = votes.length ? Math.round((approved / votes.length) * 100) : 0
    const owner = (sp.owner || '').slice(0, 6)
    console.log(`  ${l.id} ${sp.spellName || '?'} ${p / 10n**18n} GEN APPR ${appr}% [${owner}..]`)
  }
  console.log(`\nTotal value: ${total / 10n**18n} GEN`)
}

main().catch(e => console.error('FATAL:', e))
