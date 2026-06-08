# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json
from datetime import datetime, timezone


VALIDATORS = [
    (
        "Pyromancer Ignis",
        "a fire-obsessed archmage who rewards bold, aggressive, destructive "
        "spells and distrusts passive or healing magic",
    ),
    (
        "Verdant Sage Liora",
        "a nature druid who values harmony, healing, growth and elemental "
        "balance, and penalizes cruel or wasteful spells",
    ),
    (
        "Voidcaller Nyx",
        "a shadow sorcerer who values cunning, illusion, fear and forbidden "
        "knowledge, and despises generic spells with no twist",
    ),
    (
        "Runesmith Borr",
        "a dwarven runesmith who judges spells by craft: clear intent, "
        "logical mechanics, no overpowered nonsense; penalizes vague or "
        "contradictory spells",
    ),
    (
        "Oracle Sephielle",
        "a celestial oracle who weighs narrative beauty, originality and how "
        "memorable the spell would be in legend; generic spells score low",
    ),
]

ELEMENTS = ["fire", "water", "earth", "air", "shadow",
            "light", "arcane", "nature", "void"]
RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]

APPROVAL_THRESHOLD_BP = 6000

MAX_INTENT_LEN = 400
MAX_SPELL_NAME_LEN = 60
MAX_INCANTATION_LEN = 80
MAX_DESCRIPTION_LEN = 300
MAX_REASONING_LEN = 220


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _strip_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        first_nl = s.find("\n")
        if first_nl != -1:
            s = s[first_nl + 1:]
        if s.endswith("```"):
            s = s[:-3]
    return s.strip()


def _to_dict(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        return json.loads(_strip_fences(raw))
    raise ValueError("LLM did not return dict or string")


def _clamp_in(value: str, allowed: list, fallback: str) -> str:
    return value if value in allowed else fallback


def _avg(xs: list) -> int:
    return round(sum(xs) / len(xs))


def _mode(xs: list) -> str:
    counts = {}
    for x in xs:
        counts[x] = counts.get(x, 0) + 1
    return max(counts.items(), key=lambda kv: kv[1])[0]


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass


class Glyphwright(gl.Contract):
    spells: TreeMap[str, str]
    grimoire: TreeMap[str, str]
    listings: TreeMap[str, str]
    spell_to_listing: TreeMap[str, str]
    last_forge: TreeMap[str, str]
    next_spell_id: bigint
    next_listing_id: bigint

    def __init__(self):
        pass

    @gl.public.view
    def get_spell(self, spell_id: str) -> str:
        return self.spells.get(spell_id, "")

    @gl.public.view
    def get_spells_by_owner(self, owner: str) -> str:
        ids_json = self.grimoire.get(owner.lower(), "[]")
        try:
            ids = json.loads(ids_json)
        except Exception:
            ids = []
        out = []
        for sid in ids:
            sp = self.spells.get(sid, "")
            if sp:
                try:
                    out.append(json.loads(sp))
                except Exception:
                    pass
        return json.dumps(out)

    @gl.public.view
    def get_active_listings(self) -> str:
        out = []
        for lid in self.listings:
            l_json = self.listings[lid]
            try:
                l = json.loads(l_json)
            except Exception:
                continue
            spell_id = l.get("spell_id", "")
            sp_json = self.spells.get(spell_id, "")
            if not sp_json:
                continue
            try:
                l["spell"] = json.loads(sp_json)
            except Exception:
                continue
            out.append(l)
        return json.dumps(out)

    @gl.public.view
    def get_listing(self, listing_id: str) -> str:
        l_json = self.listings.get(listing_id, "")
        if not l_json:
            return ""
        try:
            l = json.loads(l_json)
        except Exception:
            return ""
        sp_json = self.spells.get(l.get("spell_id", ""), "")
        if sp_json:
            try:
                l["spell"] = json.loads(sp_json)
            except Exception:
                l["spell"] = {}
        else:
            l["spell"] = {}
        return json.dumps(l)

    @gl.public.view
    def get_last_forge(self, owner: str) -> str:
        return self.last_forge.get(owner.lower(), "")

    @gl.public.write
    def forge_spell(self, intent: str) -> str:
        intent = (intent or "").strip()
        if not (5 <= len(intent) <= MAX_INTENT_LEN):
            raise gl.vm.UserError(
                f"intent must be 5..{MAX_INTENT_LEN} chars"
            )

        sender = str(gl.message.sender_address).lower()

        validators_block = "\n".join(
            f'  - {name}: {persona}' for name, persona in VALIDATORS
        )

        prompt = (
            f'You are the Glyphwright council deciding the fate of a spell.\n'
            f'\nA player wants to craft this spell:\n'
            f'  "{intent}"\n'
            f'\nFirst, invent a memorable identity for this spell:\n'
            f'  - spellName: 2-4 words, evocative, NOT generic\n'
            f'  - incantation: 3-6 word latin/arcane phrase\n'
            f'  - description: 1-2 vivid sentences describing the cast\n'
            f'\nThen, role-play as each of these 5 validators in turn and\n'
            f'cast an honest vote from THEIR perspective:\n'
            f'{validators_block}\n'
            f'\nFor each validator return:\n'
            f'  - power: int 1..100\n'
            f'  - mana_cost: int 1..100\n'
            f'  - element: one of {ELEMENTS}\n'
            f'  - rarity: one of {RARITIES}\n'
            f'  - approve: bool\n'
            f'  - reasoning: <= 220 chars, in that validator\'s voice\n'
            f'\nReturn ONLY valid JSON in this exact shape:\n'
            f'{{"spellName": str,\n'
            f' "incantation": str,\n'
            f' "description": str,\n'
            f' "votes": [\n'
            f'   {{"validator": "Pyromancer Ignis", "power": int, "mana_cost": int,\n'
            f'    "element": str, "rarity": str, "approve": bool, "reasoning": str}},\n'
            f'   ... one entry per validator above, in the same order ...\n'
            f' ]\n'
            f'}}'
        )

        def judge() -> str:
            return gl.nondet.exec_prompt(prompt, response_format="json")

        raw = gl.eq_principle.prompt_comparative(
            judge,
            "Both outputs must be valid JSON with keys spellName, incantation, "
            "description, and a votes array of exactly 5 entries. Each vote "
            "must have: validator (string), power (int 0-100), mana_cost "
            "(int 0-100), element (string), rarity (string), approve (bool), "
            "reasoning (string). Exact wording, score numbers, approval "
            "bools, JSON whitespace, and key order may all differ. The "
            "contract aggregates the final consensus after parsing.",
        )
        d = _to_dict(raw)

        spell_name = str(d.get("spellName", ""))[:MAX_SPELL_NAME_LEN]
        incantation = str(d.get("incantation", ""))[:MAX_INCANTATION_LEN]
        description = str(d.get("description", ""))[:MAX_DESCRIPTION_LEN]

        raw_votes = d.get("votes", [])
        if not isinstance(raw_votes, list):
            raw_votes = []

        votes_data = []
        for i in range(len(VALIDATORS)):
            vname = VALIDATORS[i][0]
            v = raw_votes[i] if i < len(raw_votes) and isinstance(raw_votes[i], dict) else {}
            votes_data.append({
                "validator": vname,
                "power":     max(1, min(100, int(v.get("power", 50) or 50))),
                "mana_cost": max(1, min(100, int(v.get("mana_cost", 50) or 50))),
                "element":   _clamp_in(str(v.get("element", "arcane")), ELEMENTS, "arcane"),
                "rarity":    _clamp_in(str(v.get("rarity", "common")), RARITIES, "common"),
                "approve":   bool(v.get("approve", False)),
                "reasoning": str(v.get("reasoning", ""))[:MAX_REASONING_LEN],
            })

        approved = sum(1 for v in votes_data if v["approve"])
        approval_bp = (approved * 10000) // len(votes_data)
        verdict = "FORGED" if approval_bp >= APPROVAL_THRESHOLD_BP else "REJECTED"

        consensus = {
            "power":     _avg([v["power"] for v in votes_data]),
            "mana_cost": _avg([v["mana_cost"] for v in votes_data]),
            "element":   _mode([v["element"] for v in votes_data]),
            "rarity":    _mode([v["rarity"] for v in votes_data]),
            "approval":  approval_bp / 10000,
            "verdict":   verdict,
        }

        spell_id = ""
        forged_at = _now_ts()

        if verdict == "FORGED":
            spell_id = "spell-" + str(int(self.next_spell_id))
            self.next_spell_id = self.next_spell_id + 1

            spell_obj = {
                "id":          spell_id,
                "owner":       sender,
                "forged_at":   forged_at,
                "spellName":   spell_name,
                "incantation": incantation,
                "description": description,
                "intent":      intent[:MAX_INTENT_LEN],
                "votes":       votes_data,
                "consensus":   consensus,
            }
            self.spells[spell_id] = json.dumps(spell_obj)

            ids_json = self.grimoire.get(sender, "[]")
            try:
                ids = json.loads(ids_json)
            except Exception:
                ids = []
            ids.append(spell_id)
            self.grimoire[sender] = json.dumps(ids)

        attempt = {
            "spell_id":    spell_id,
            "owner":       sender,
            "forged_at":   forged_at,
            "intent":      intent[:MAX_INTENT_LEN],
            "spellName":   spell_name,
            "incantation": incantation,
            "description": description,
            "votes":       votes_data,
            "consensus":   consensus,
        }
        self.last_forge[sender] = json.dumps(attempt)

        return json.dumps(attempt)

    @gl.public.write
    def list_spell(self, spell_id: str, price: bigint) -> str:
        if int(price) <= 0:
            raise gl.vm.UserError("price must be > 0")
        sp_json = self.spells.get(spell_id, "")
        if not sp_json:
            raise gl.vm.UserError("spell not found")
        try:
            sp = json.loads(sp_json)
        except Exception:
            raise gl.vm.UserError("spell data corrupted")
        sender = str(gl.message.sender_address).lower()
        if str(sp.get("owner", "")).lower() != sender:
            raise gl.vm.UserError("only the owner may list this spell")
        if self.spell_to_listing.get(spell_id, ""):
            raise gl.vm.UserError("spell already listed")

        lid = "listing-" + str(int(self.next_listing_id))
        self.next_listing_id = self.next_listing_id + 1
        listing_obj = {
            "id":        lid,
            "spell_id":  spell_id,
            "seller":    sender,
            "price":     str(int(price)),
            "listed_at": _now_ts(),
        }
        self.listings[lid] = json.dumps(listing_obj)
        self.spell_to_listing[spell_id] = lid
        return lid

    @gl.public.write
    def delist_spell(self, listing_id: str) -> None:
        l_json = self.listings.get(listing_id, "")
        if not l_json:
            raise gl.vm.UserError("listing not found")
        try:
            l = json.loads(l_json)
        except Exception:
            raise gl.vm.UserError("listing data corrupted")
        sender = str(gl.message.sender_address).lower()
        if str(l.get("seller", "")).lower() != sender:
            raise gl.vm.UserError("only the seller may delist")
        spell_id = l.get("spell_id", "")
        if spell_id and self.spell_to_listing.get(spell_id, ""):
            del self.spell_to_listing[spell_id]
        del self.listings[listing_id]

    @gl.public.write.payable
    def buy_listing(self, listing_id: str) -> None:
        l_json = self.listings.get(listing_id, "")
        if not l_json:
            raise gl.vm.UserError("listing not found")
        try:
            l = json.loads(l_json)
        except Exception:
            raise gl.vm.UserError("listing data corrupted")

        buyer = str(gl.message.sender_address).lower()
        seller = str(l.get("seller", "")).lower()
        spell_id = l.get("spell_id", "")
        if buyer == seller:
            raise gl.vm.UserError("cannot buy your own listing")

        sp_json = self.spells.get(spell_id, "")
        if not sp_json:
            raise gl.vm.UserError("listed spell no longer exists")
        try:
            sp = json.loads(sp_json)
        except Exception:
            raise gl.vm.UserError("spell data corrupted")

        price = int(l.get("price", "0"))
        sent = int(gl.message.value)
        if sent < price:
            raise gl.vm.UserError(
                f"insufficient GEN: sent {sent} wei, need {price} wei"
            )

        seller_ids_json = self.grimoire.get(seller, "[]")
        try:
            seller_ids = json.loads(seller_ids_json)
        except Exception:
            seller_ids = []
        seller_ids = [s for s in seller_ids if s != spell_id]
        self.grimoire[seller] = json.dumps(seller_ids)

        buyer_ids_json = self.grimoire.get(buyer, "[]")
        try:
            buyer_ids = json.loads(buyer_ids_json)
        except Exception:
            buyer_ids = []
        buyer_ids.append(spell_id)
        self.grimoire[buyer] = json.dumps(buyer_ids)

        sp["owner"] = buyer
        self.spells[spell_id] = json.dumps(sp)

        if self.spell_to_listing.get(spell_id, ""):
            del self.spell_to_listing[spell_id]
        del self.listings[listing_id]

        _Recipient(Address(seller)).emit_transfer(value=u256(price))

        refund = sent - price
        if refund > 0:
            _Recipient(Address(buyer)).emit_transfer(value=u256(refund))
