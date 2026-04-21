import { useTranslation } from 'react-i18next'

const CATEGORIES = [
  'Chemicals', 'Cleaning Supplies', 'Disinfectants', 'Consumables',
  'Equipment', 'Tools', 'PPE', 'Paper Products', 'Trash & Liners',
  'Restroom Supplies', 'Kitchen Supplies', 'Office Supplies', 'Other',
]

export default function CategoryInput({ id = 'category', name = 'category', value, onChange, className }) {
  const { t } = useTranslation()
  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        list="category-options"
        className={className}
        placeholder={t('select_placeholder')}
        value={value}
        onChange={onChange}
      />
      <datalist id="category-options">
        {CATEGORIES.map((c) => <option key={c} value={c} />)}
      </datalist>
    </>
  )
}
