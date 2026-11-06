# Pantry Owl

A Progressive Web App (PWA) for a food pantry. Clients browse items, build a shopping list, and generate a QR code. Cashiers scan the code at pickup. Stockers keep availability current. Admins manage accounts and see data.

- **Repo:** https://github.com/KevinB6766/pantry_owl.git
- **Stack:** Next.js + React + TypeScript (frontend), FastAPI (backend), Supabase (Postgres + Auth), USDA FoodData Central (nutrition), Render (hosting). See [CURRENT_STATE.md](CURRENT_STATE.md) for what is built.
- **Related files:** [DELIVERABLES.md](DELIVERABLES.md) · [CURRENT_STATE.md](CURRENT_STATE.md)

---

## 1. Roles

| Role | Can do |
|---|---|
| **User** | Browse items, build/save shopping list, generate QR code, star items and get availability pings, recipe lookup, live chat, submit bugs/suggestions |
| **Cashier** | Scan QR code, add/drop items, undo previous action, manually enter items, change item availability |
| **Stocker** | Add items, update availability when restocked |
| **Admin** | Control accounts (create, change permissions, remove cashiers), view dashboard, manage splash/emergency notices |

All roles can log in.

---

## 2. Data Model

### Items
| Field | Notes |
|---|---|
| Item ID | Unchangeable |
| Name | |
| Price | |
| Image URL | Supports carousel (multiple images) |
| Tags | vegan, vegetarian, halal, kosher, canned, fruit, veggie, grain, pasta, etc. |
| Points cost | |
| Nutrition label image | |
| Weight | |
| Ingredients text | |
| Amount | Quantity in stock |
| Limits | Max per person/visit |
| Combos | Related/frequently bought together items |
| Out of stock | Flag |
| Added date | Drives "newly added" homepage splash |

### Accounts
| Field | Notes |
|---|---|
| Account ID | Unchangeable |
| Account permissions | user / cashier / stocker / admin |
| Email | |
| Password | Store hashed only |

### Other tables (implied by features)
- Shopping lists (saved lists, QR payload)
- Transactions / bought items (feeds dashboard)
- Starred items / ping subscriptions
- Splash notices (new items, closings, emergencies)
- Reports (bugs, issues, suggestions)
- Chat messages

---

## 3. Features

### Core
- PWA (installable, offline-capable shopping list)
- Item browsing with tags and image carousel
- Add to shopping list; multiple items per item allowed
- QR code generated from shopping list
- User can save shopping list locally
- Availability check: every time the items page opens, a read request goes to the DB

### Splash / Promotion
- Homepage splash for newly added items
- "Frequently bought together" bottom splash
- Splash options for closings or emergencies

### Cashier tools
- Scan QR code to load items
- Menu to add or drop items, undo the previous action, or enter items manually

### Admin tools
- Dashboard: bought items, items left, most popular
- Remove cashiers / control accounts

### Stocker tools
- Add items
- Update availability on restock

### User extras
- Pings when starred items become available
- Recipe lookup
- Live chat for questions
- Bug / issue / suggestion box

---

## 4. Database Interactions

| Role | Reads | Writes |
|---|---|---|
| User | Items, availability | Ping subscriptions (stars), reports |
| Cashier | Items, shopping lists | Item availability, transactions |
| Stocker | Items | New items, availability |
| Admin | Everything | Accounts and permissions, splash notices |

---

## 5. Open Questions
- Keep `categories` or replace with tags?
- Can guests build and save a list without an account?
- Render free tier sleeps; upgrade or keep-alive?
- Are "points" a client balance spent at checkout, and does price still matter?
- How are push pings delivered (web push, email)?
- Live chat: real-time staff chat or a bot?
- Recipe lookup: external API or built in?
- Auth method for clients (email/password only, or guest access)?
