import React from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useWorkbook } from '../context/WorkbookContext'

export default function WorkbookSelector() {
  const { sheets, selectedSheet, selectSheet } = useWorkbook()

  if (!sheets.length) return null

  return (
    <div className="flex items-center gap-2">
      <FileSpreadsheet size={15} className="text-primary shrink-0" />
      <select
        className="select !py-1.5 text-[13px] max-w-[260px]"
        value={selectedSheet}
        onChange={(event) => selectSheet(event.target.value)}
      >
        {sheets.map((sheet) => (
          <option key={sheet.name} value={sheet.name}>
            {sheet.name}
          </option>
        ))}
      </select>
    </div>
  )
}
