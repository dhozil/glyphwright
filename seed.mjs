import { createClient, createAccount } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const CONTRACT = '0xF4F4ee451A0A687cb59379d6A3913fe99D698d3E'
const PRIV_KEY = '0x499b5c7cf2e472fe929eaf7223366b5efa2cc1eafb2573ed30ff52144617fe4d'
const account = createAccount(PRIV_KEY)
console.log(`Account: ${account.address}, priv: ${PRIV_KEY}`)

const client = createClient({ chain: studionet, account })

const INTENTS = [
  'A whispered command that freezes someone mid-sentence, their words hanging frozen in the air like icicles',
  'A spell that turns spilled wine into a loyal liquid serpent that follows one command',
  'A single note sung that shatters all glass within earshot, then reforms it into a shimmering bird',
  'A reversed incantation that makes the caster\'s shadow act out their repressed emotions',
  'A quick gesture that makes ink bleed off a page and rewrite the sentence as an insult',
  'A mark traced on a door that lets the caster hear every lie told behind it',
  'A charm woven into a braid that lets the wearer breathe underwater for one hour per strand',
  'An enchantment that makes a locked chest play a mournful ballad about whatever is inside',
  'A hex that causes the target\'s reflection to be three seconds ahead of their movements',
  'A sigil burned into a coin that returns to the caster\'s pocket whenever spent in greed',
  'A lullaby hummed through a keyhole that puts everyone in the adjacent room into a shared dream',
  'A ritual where the caster trades their voice for one hour to speak through a nearby statue',
  'A syllabic cipher woven into a handshake that encrypts the next five words between the shakers',
  'A pinch of ash blown toward a hearth that makes the fire recount the last argument it witnessed',
  'A thread tied around a finger that lets the caster feel the nearest significant emotional residue',
  'A whisper to a dying ember that reignites only when a promise is about to be broken nearby',
  'A three-note whistle that causes shed tears to coalesce into a pearl holding the memory of that cry',
  'A tap on a mirror that lets the caster step through to the exact moment one hour ago in the same room',
  'A breath exhaled over a wound that heals faster but leaves a scar in the shape of a word the patient fears',
  'A melodic snap that locks the last door the target touched, unlocking only when they tell a sincere secret',
]

async function forge(intent) {
  const hash = await client.writeContract({
    address: CONTRACT,
    functionName: 'forge_spell',
    args: [intent],
  })
  console.log(`    tx ${hash.slice(0, 16)}...`)
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
  console.log(`    => ${id}`)
  return id
}

async function main() {
  // Get existing count
  const r = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const existing = JSON.parse(r || '[]')
  const forgedExisting = existing.filter(s => s.consensus.verdict === 'FORGED')
  console.log(`Existing: ${forgedExisting.length}/${existing.length} FORGED\n`)

  const need = 20 - forgedExisting.length
  if (need <= 0) {
    console.log('Already have 20 FORGED spells, skipping forge')
  } else {
    console.log(`Forging ${need} more spells...`)
    const toForge = INTENTS.slice(0, need)
    for (const intent of toForge) {
      try {
        await forge(intent)
      } catch (e) {
        console.log(`    FAILED: ${e.message?.slice(0, 100)}`)
      }
    }
  }

  // List all FORGED spells
  const updated = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const all = JSON.parse(updated || '[]')
  const toList = all.filter(s => s.consensus.verdict === 'FORGED')
  console.log(`\nListing ${toList.length} spells...`)

  for (const s of toList) {
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
      // might already be listed
      console.log(`  ${s.id}: ${e.message?.slice(0, 100)}`)
    }
  }

  // Verify
  const listings = await client.readContract({
    address: CONTRACT,
    functionName: 'get_active_listings',
    args: [],
  })
  const active = JSON.parse(listings || '[]')
  console.log(`\nActive listings: ${active.length}`)
  active.forEach(l => console.log(`  ${l.id}: ${l.spell?.spellName} — ${BigInt(l.price||'0') / 10n**18n} GEN`))
}

main().catch(e => console.error('FATAL:', e))
