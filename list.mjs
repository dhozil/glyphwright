import { createClient, createAccount } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const CONTRACT = '0xe0d7385b9E15FF4b4EBFf7A15e293F290ecA0e29'

// The burner account from seed.mjs
const PRIV_KEY = '0x499b5c7cf2e472fe929eaf7223366b5efa2cc1eafb2573ed30ff52144617fe4d'
const account = createAccount(PRIV_KEY)
console.log(`Account: ${account.address}`)

const client = createClient({ chain: studionet, account })

async function listSpell(spellId, priceGen) {
  const priceWei = priceGen * 10n ** 18n
  const hash = await client.writeContract({
    address: CONTRACT,
    functionName: 'list_spell',
    args: [spellId, priceWei],
  })
  console.log(`  TX: ${hash.slice(0, 18)}...`)
  const tx = await client.waitForTransactionReceipt({
    hash,
    status: 2,
    retries: 200,
    interval: 2000,
  })
  return tx
}

async function main() {
  // Get all spells for this account
  const r = await client.readContract({
    address: CONTRACT,
    functionName: 'get_spells_by_owner',
    args: [account.address],
  })
  const spells = JSON.parse(r || '[]')
  console.log(`Spells: ${spells.length}`)
  spells.forEach(s => console.log(`  ${s.id}: "${s.spellName}" (${s.consensus.verdict})`))

  // List each FORGED spell with a random price 3-31 GEN
  const forged = spells.filter(s => s.consensus.verdict === 'FORGED')
  console.log(`\nListing ${forged.length} spells...`)
  for (const s of forged) {
    const price = BigInt(3 + Math.floor(Math.random() * 28))
    try {
      await listSpell(s.id, price)
      console.log(`  ✓ ${s.id}: ${s.spellName} — ${price} GEN`)
    } catch (e) {
      console.log(`  ✗ ${s.id}: ${e.message?.slice(0, 100)}`)
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
  active.forEach(l => console.log(`  ${l.id}: ${l.spell?.spellName} — ${l.price} wei`))
}

main().catch(e => console.error('FATAL:', e))
