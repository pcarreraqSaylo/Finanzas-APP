import { KpiStrip } from '../components/KpiStrip'
import { EntryWheel } from '../components/EntryWheel'
import { IncomeButton } from '../components/IncomeButton'
import { ExtrasMenu } from '../components/ExtrasMenu'

export function Home({ resetKey }: { resetKey?: number }) {
  return (
    <div className="relative flex flex-1 flex-col gap-2 overflow-hidden">
      <div className="relative">
        <KpiStrip />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4 pt-0">
        <div className="flex flex-1 items-start justify-center pt-2">
          <EntryWheel resetKey={resetKey} />
        </div>
        <ExtrasMenu />
        <IncomeButton />
      </div>
    </div>
  )
}
