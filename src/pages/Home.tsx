import { useState } from 'react'
import { KpiStrip } from '../components/KpiStrip'
import { EntryWheel } from '../components/EntryWheel'
import { IncomeButton } from '../components/IncomeButton'
import { ExtrasMenu } from '../components/ExtrasMenu'

type Panel = 'wheel' | 'income' | 'extras'

export function Home({ resetKey }: { resetKey?: number }) {
  // The wheel, "Agregar Ingresos", and the Extras "+" are mutually exclusive — opening
  // one bumps the other two's close key, which each component treats as "reset me"
  // regardless of whether it was actually open (a no-op reset if it wasn't).
  const [wheelCloseKey, setWheelCloseKey] = useState(0)
  const [incomeCloseKey, setIncomeCloseKey] = useState(0)
  const [extrasCloseKey, setExtrasCloseKey] = useState(0)

  function handleOpenChange(panel: Panel, open: boolean) {
    if (!open) return
    if (panel !== 'wheel') setWheelCloseKey((k) => k + 1)
    if (panel !== 'income') setIncomeCloseKey((k) => k + 1)
    if (panel !== 'extras') setExtrasCloseKey((k) => k + 1)
  }

  return (
    <div className="relative flex flex-1 flex-col gap-2 overflow-hidden">
      <div className="relative">
        <KpiStrip />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4 pt-0">
        <div className="flex flex-1 items-start justify-center pt-2">
          <EntryWheel
            resetKey={resetKey}
            forceCloseKey={wheelCloseKey}
            onOpenChange={(open) => handleOpenChange('wheel', open)}
          />
        </div>
        <ExtrasMenu forceCloseKey={extrasCloseKey} onOpenChange={(open) => handleOpenChange('extras', open)} />
        <IncomeButton forceCloseKey={incomeCloseKey} onOpenChange={(open) => handleOpenChange('income', open)} />
      </div>
    </div>
  )
}
