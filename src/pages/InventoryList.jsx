import { useState } from 'react'
import styles from './InventoryList.module.css'

const LOCATIONS = ['All', 'Truck 1', 'Truck 2', 'Warehouse', 'Office', 'Site A', 'Site B']

const SAMPLE_ITEMS = [
  { id: 1, name: 'All-Purpose Cleaner', sku: 'CLN-001', category: 'Chemicals', location: 'Truck 1', quantity: 8, unit: 'bottle', minQuantity: 3 },
  { id: 2, name: 'Microfiber Cloths', sku: 'EQP-004', category: 'Equipment', location: 'Truck 1', quantity: 24, unit: 'each', minQuantity: 10 },
  { id: 3, name: 'Latex Gloves (M)', sku: 'PPE-002', category: 'PPE', location: 'Truck 2', quantity: 2, unit: 'box', minQuantity: 5 },
  { id: 4, name: 'Floor Wax', sku: 'CLN-012', category: 'Chemicals', location: 'Warehouse', quantity: 4, unit: 'gallon', minQuantity: 2 },
  { id: 5, name: 'Mop Heads', sku: 'EQP-009', category: 'Equipment', location: 'Truck 2', quantity: 3, unit: 'each', minQuantity: 2 },
  { id: 6, name: 'Disinfectant Spray', sku: 'CLN-007', category: 'Chemicals', location: 'Office', quantity: 1, unit: 'bottle', minQuantity: 4 },
  { id: 7, name: 'Safety Goggles', sku: 'PPE-005', category: 'PPE', location: 'Warehouse', quantity: 12, unit: 'each', minQuantity: 4 },
  { id: 8, name: 'Trash Bags (HD)', sku: 'CON-003', category: 'Consumables', location: 'Truck 1', quantity: 2, unit: 'box', minQuantity: 3 },
]

function StatusBadge({ quantity, minQuantity }) {
  if (quantity === 0) return <span className={`${styles.badge} ${styles.badgeOut}`}>Out</span>
  if (quantity <= minQuantity) return <span className={`${styles.badge} ${styles.badgeLow}`}>Low</span>
  return <span className={`${styles.badge} ${styles.badgeOk}`}>OK</span>
}

export default function InventoryList() {
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('All')

  const filtered = SAMPLE_ITEMS.filter((item) => {
    const matchesLocation = location === 'All' || item.location === location
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
    return matchesLocation && matchesSearch
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Inventory</h1>
        <span className={styles.count}>{filtered.length} items</span>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search items or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.locationTabs}>
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              className={`${styles.locationTab} ${location === loc ? styles.locationTabActive : ''}`}
              onClick={() => setLocation(loc)}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p>No items found</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemMain}>
                <div className={styles.itemName}>{item.name}</div>
                <div className={styles.itemMeta}>
                  <span className={styles.sku}>{item.sku}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.category}>{item.category}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.locationTag}>{item.location}</span>
                </div>
              </div>
              <div className={styles.itemRight}>
                <div className={styles.qty}>
                  {item.quantity} <span className={styles.unit}>{item.unit}</span>
                </div>
                <StatusBadge quantity={item.quantity} minQuantity={item.minQuantity} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
