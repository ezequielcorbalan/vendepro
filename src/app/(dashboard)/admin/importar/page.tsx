'use client'
import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, X, Users, Building2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import * as XLSX from 'xlsx'

type ParsedRow = Record<string, any>
type ImportTarget = 'leads' | 'properties'

const LEAD_FIELD_MAP: Record<string, string> = {
  'Nombre completo': 'full_name',
  'nombre': 'full_name',
  'Teléfono': 'phone',
  'telefono': 'phone',
  'Email': 'email',
  'Origen': 'source',
  'origen': 'source',
  'Tipo Operación': 'operation',
  'operacion': 'operation',
  'Barrio/Zona': 'neighborhood',
  'barrio': 'neighborhood',
  'Dirección propiedad': 'property_address',
  'direccion': 'property_address',
  'Valor estimado (USD)': 'estimated_value',
  'valor': 'estimated_value',
  'Asignar agente': 'agent_name',
  'agente': 'agent_name',
  'Notas': 'notes',
  'notas': 'notes',
}

const PROP_FIELD_MAP: Record<string, string> = {
  'Dirección': 'address',
  'direccion': 'address',
  'Barrio/Zona': 'neighborhood',
  'barrio': 'neighborhood',
  'Localidad': 'city',
  'Tipo Propiedad': 'property_type',
  'tipo': 'property_type',
  'Precio': 'asking_price',
  'precio': 'asking_price',
  'Ambientes': 'rooms',
  'ambientes': 'rooms',
  'Dormitorios': 'bedrooms',
  'dormitorios': 'bedrooms',
  'Baños': 'bathrooms',
  'Superficie Total m²': 'size_m2',
  'Superficie Cubierta m²': 'covered_area',
  'Piso': 'floor_number',
  'Año Construcción': 'year_built',
  'Expensas ARS': 'expenses',
  'Apto Crédito': 'credit_eligible',
  'Propietario': 'owner_name',
  'Tel Propietario': 'owner_phone',
  'Agente': 'agent_name',
  'Código KP': 'kp_code',
}

function mapRow(row: ParsedRow, fieldMap: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {}
  for (const [excelKey, dbKey] of Object.entries(fieldMap)) {
    if (row[excelKey] !== undefined && row[excelKey] !== null && row[excelKey] !== '') {
      let val = row[excelKey]
      // Clean price values
      if (dbKey === 'asking_price' || dbKey === 'estimated_value' || dbKey === 'expenses') {
        val = String(val).replace(/\./g, '').replace(/,/g, '').replace(/[^0-9.-]/g, '')
        val = parseFloat(val) || null
      }
      // Normalize operation
      if (dbKey === 'operation') val = String(val).toLowerCase()
      // Normalize property type
      if (dbKey === 'property_type') {
        val = String(val).toLowerCase()
        if (val.includes('departamento')) val = 'departamento'
        if (val === 'casas') val = 'casa'
        if (val.includes('ph')) val = 'ph'
      }
      // Credit eligible
      if (dbKey === 'credit_eligible') val = val === 'Si' || val === 'si' || val === true ? 1 : 0
      mapped[dbKey] = val
    }
  }
  return mapped
}

export default function ImportarPage() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [target, setTarget] = useState<ImportTarget>('leads')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      setWorkbook(wb)
      setSheets(wb.SheetNames)
      // Auto-select first sheet
      if (wb.SheetNames.length > 0) {
        loadSheet(wb, wb.SheetNames[0])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const loadSheet = (wb: XLSX.WorkBook, name: string) => {
    setSelectedSheet(name)
    const ws = wb.Sheets[name]
    const json = XLSX.utils.sheet_to_json(ws) as ParsedRow[]
    const hdrs = json.length > 0 ? Object.keys(json[0]) : []
    setHeaders(hdrs)
    setRows(json)

    // Auto-detect target
    if (hdrs.some(h => h.includes('Tipo Propiedad') || h.includes('Superficie'))) {
      setTarget('properties')
    } else {
      setTarget('leads')
    }
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    setResult(null)

    const fieldMap = target === 'leads' ? LEAD_FIELD_MAP : PROP_FIELD_MAP
    const mapped = rows.map(r => mapRow(r, fieldMap)).filter(r => {
      if (target === 'leads') return r.full_name
      return r.address
    })

    let success = 0, failed = 0
    const errors: string[] = []

    for (const row of mapped) {
      try {
        const endpoint = target === 'leads' ? '/api/leads' : '/api/properties'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target === 'leads' ? {
            ...row,
            source: row.source || 'Excel import',
            stage: 'contactado',
          } : {
            ...row,
            status: 'active',
            commercial_stage: 'captada',
          }),
        })
        const data = await res.json() as any
        if (res.ok && !data.error) {
          success++
        } else {
          failed++
          const name = row.full_name || row.address || 'Fila desconocida'
          errors.push(`${name}: ${data.error || 'Error desconocido'}`)
        }
      } catch {
        failed++
      }
    }

    setResult({ success, failed, errors })
    setImporting(false)
    if (success > 0) toast(`${success} ${target === 'leads' ? 'leads' : 'propiedades'} importados`, 'success')
    if (failed > 0) toast(`${failed} fallaron`, 'error')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Upload className="w-6 h-6 text-[#ff007c]" /> Importar datos
        </h1>
        <p className="text-sm text-gray-400 mt-1">Carg&aacute; leads o propiedades desde un archivo Excel</p>
      </div>

      {/* Upload */}
      <div
        className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center cursor-pointer hover:border-[#ff007c]/40 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium">
          {rows.length > 0 ? `${rows.length} filas cargadas de "${selectedSheet}"` : 'Hacé click o arrastrá un archivo .xlsx'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Soporta archivos Excel (.xlsx, .xls)</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      </div>

      {/* Sheet selector */}
      {sheets.length > 1 && (
        <div className="flex gap-2">
          {sheets.map(name => (
            <button key={name} onClick={() => workbook && loadSheet(workbook, name)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedSheet === name ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {name}
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Target selector */}
          <div className="flex gap-3">
            <button onClick={() => setTarget('leads')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                target === 'leads' ? 'border-[#ff007c] bg-[#ff007c]/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <Users className={`w-6 h-6 mb-2 ${target === 'leads' ? 'text-[#ff007c]' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-800">Leads</p>
              <p className="text-xs text-gray-400">Contactos comerciales</p>
            </button>
            <button onClick={() => setTarget('properties')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                target === 'properties' ? 'border-[#ff007c] bg-[#ff007c]/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <Building2 className={`w-6 h-6 mb-2 ${target === 'properties' ? 'text-[#ff007c]' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-800">Propiedades</p>
              <p className="text-xs text-gray-400">Inmuebles para el pipeline</p>
            </button>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Vista previa ({rows.length} filas)</span>
              <span className="text-xs text-gray-400">{headers.length} columnas detectadas</span>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {headers.slice(0, 8).map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                    {headers.length > 8 && <th className="px-3 py-2 text-gray-400">+{headers.length - 8} m&aacute;s</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      {headers.slice(0, 8).map(h => (
                        <td key={h} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[200px] truncate">{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                  {rows.length > 5 && (
                    <tr><td colSpan={9} className="px-3 py-2 text-center text-gray-400">...y {rows.length - 5} filas m&aacute;s</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field mapping info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-medium mb-1">Mapeo autom&aacute;tico de columnas</p>
            <p>Las columnas del Excel se mapean a campos del CRM autom&aacute;ticamente por nombre. Si quer&eacute;s ajustar el mapeo, renombr&aacute; las columnas en el Excel antes de importar.</p>
          </div>

          {/* Import button */}
          <button onClick={handleImport} disabled={importing}
            className="w-full bg-[#ff007c] text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando {rows.length} {target}...</>
              : <><Upload className="w-4 h-4" /> Importar {rows.length} {target}</>}
          </button>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.failed > 0 ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
                <span className="text-sm font-semibold text-gray-800">
                  {result.success} importados, {result.failed} fallaron
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
