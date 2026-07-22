// Custom React Flow node renderers for lean-VSM symbols (see VsmNodeType on the backend), covering
// both the always-on GENERIC pack and the opt-in MANUFACTURING pack (Phase 5) -- which of these
// actually show up on a given installation's palette is decided server-side (VsmMapService
// #getAvailableNodeTypes, gated by the VSM_ENABLED_NOTATION_PACKS organization_setting), not here;
// this file just needs a renderer ready for every VsmNodeType that could ever be sent back. Each is
// a small styled card with left/right connection handles for material-flow edges; KaizenBurstNodeCard
// additionally gets a distinct starburst shape per lean-VSM convention, since it marks an improvement
// opportunity rather than a step in the flow itself.
import { Handle, Position } from '@xyflow/react'

const baseCardStyle = {
  minWidth: 160,
  padding: '10px 14px',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
}

function MetricLine({ label, value, unit }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ color: '#6b7280', fontSize: 11 }}>
      {label}: {value}{unit || ''}
    </div>
  )
}

function CardShell({ data, style, children }) {
  return (
    <div style={{ ...baseCardStyle, ...style }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>{data.title}</div>
      <MetricLine label="Cycle time" value={data.cycleTimeMinutes} unit=" min" />
      <MetricLine label="%C&A" value={data.completeAccuratePercent} unit="%" />
      <MetricLine label="Fail rate" value={data.failRatePercent} unit="%" />
      {children}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export function ProcessNodeCard({ data }) {
  return <CardShell data={data} style={{ border: '2px solid #13223a' }} />
}

export function DataBoxNodeCard({ data }) {
  return <CardShell data={data} style={{ border: '1px dashed #6b7280', background: '#f8fafc' }} />
}

export function SupplierCustomerNodeCard({ data }) {
  return <CardShell data={data} style={{ border: '2px solid #c9a24b', background: '#fffbea' }} />
}

export function KaizenBurstNodeCard({ data }) {
  // The starburst shape is drawn via clip-path on an INNER div only -- clip-path also clips any
  // absolutely-positioned children, so a Handle placed inside the clipped element gets cut away
  // wherever the star's outline doesn't reach the plain left/right-middle point React Flow places
  // it at, making the node visually unconnectable. Keeping the Handles on this unclipped outer
  // wrapper instead means they're always fully visible/clickable regardless of the star's outline.
  return (
    <div style={{ position: 'relative', minWidth: baseCardStyle.minWidth }}>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          ...baseCardStyle,
          border: '2px solid #d4380d',
          background: '#fff2e8',
          clipPath:
            'polygon(50% 0%, 61% 20%, 82% 10%, 78% 32%, 100% 38%, 84% 53%, 96% 72%, 74% 70%, 70% 92%, 52% 78%, 32% 96%, 30% 74%, 8% 82%, 20% 62%, 0% 48%, 22% 40%, 12% 18%, 34% 26%)',
          padding: '18px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 700, color: '#ad2102' }}>{data.title}</div>
        {/* A task can only attach to a real, already-saved node -- unsaved (freshly-added) kaizen
            bursts have no id yet for improvement_task.kaizen_node_id to reference. */}
        {data.isExisting && data.onCreateTask && (
          <div
            role="button"
            onClick={(e) => { e.stopPropagation(); data.onCreateTask() }}
            style={{
              marginTop: 6, fontSize: 11, color: '#ad2102', textDecoration: 'underline', cursor: 'pointer',
            }}
          >
            {data.createTaskLabel}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

// ── MANUFACTURING pack (Phase 5) ────────────────────────────────────────────

export function InventoryNodeCard({ data }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center' }}>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          width: 0, height: 0, margin: '0 auto',
          borderLeft: '30px solid transparent', borderRight: '30px solid transparent',
          borderBottom: '50px solid #fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.18))',
        }}
      />
      <div style={{ marginTop: -46, fontWeight: 700, color: '#92400e' }}>!</div>
      <div style={{ fontSize: 11, marginTop: 4 }}>{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export function SupermarketNodeCard({ data }) {
  return (
    <CardShell data={data} style={{ border: '2px solid #0f766e', background: '#f0fdfa' }}>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: 10, border: '1px solid #0f766e', borderRadius: 2 }} />
        ))}
      </div>
    </CardShell>
  )
}

export function PushArrowNodeCard({ data }) {
  return (
    <div style={{ ...baseCardStyle, border: 'none', boxShadow: 'none', background: 'transparent', textAlign: 'center' }}>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          width: 0, height: 0, margin: '0 auto',
          borderTop: '18px solid transparent', borderBottom: '18px solid transparent',
          borderLeft: '34px solid #475569',
        }}
      />
      <div style={{ fontSize: 11, marginTop: 4, color: '#334155' }}>{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export function ShipmentNodeCard({ data }) {
  return <CardShell data={data} style={{ border: '2px solid #1d4ed8', background: '#eff6ff' }} />
}

export function KanbanBatchNodeCard({ data }) {
  return (
    <div style={{ ...baseCardStyle, border: '2px solid #7c3aed', background: '#f5f3ff', position: 'relative' }}>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          position: 'absolute', top: -8, left: -8, width: 16, height: 16,
          background: '#7c3aed', borderRadius: '50%',
        }}
      />
      <div style={{ fontWeight: 600 }}>{data.title}</div>
      <MetricLine label="Cycle time" value={data.cycleTimeMinutes} unit=" min" />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export const vsmNodeTypes = {
  PROCESS: ProcessNodeCard,
  DATA_BOX: DataBoxNodeCard,
  SUPPLIER_CUSTOMER: SupplierCustomerNodeCard,
  KAIZEN_BURST: KaizenBurstNodeCard,
  INVENTORY: InventoryNodeCard,
  SUPERMARKET: SupermarketNodeCard,
  PUSH_ARROW: PushArrowNodeCard,
  SHIPMENT: ShipmentNodeCard,
  KANBAN_BATCH: KanbanBatchNodeCard,
}

export const NODE_TYPE_LABELS = {
  PROCESS: 'Process',
  DATA_BOX: 'Data Box',
  SUPPLIER_CUSTOMER: 'Supplier / Customer',
  KAIZEN_BURST: 'Kaizen Burst',
  INVENTORY: 'Inventory',
  SUPERMARKET: 'Supermarket',
  PUSH_ARROW: 'Push Arrow',
  SHIPMENT: 'Shipment',
  KANBAN_BATCH: 'Kanban Batch',
}

// i18n keys for the InfoTip shown next to each palette button/card -- kept alongside the other
// per-node-type maps above so a future notation pack only needs one new entry per map, not a
// separate lookup to maintain in sync.
export const NODE_TYPE_INFO_KEYS = {
  PROCESS: 'vsm.nodeTypeInfoProcess',
  DATA_BOX: 'vsm.nodeTypeInfoDataBox',
  SUPPLIER_CUSTOMER: 'vsm.nodeTypeInfoSupplierCustomer',
  KAIZEN_BURST: 'vsm.nodeTypeInfoKaizenBurst',
  INVENTORY: 'vsm.nodeTypeInfoInventory',
  SUPERMARKET: 'vsm.nodeTypeInfoSupermarket',
  PUSH_ARROW: 'vsm.nodeTypeInfoPushArrow',
  SHIPMENT: 'vsm.nodeTypeInfoShipment',
  KANBAN_BATCH: 'vsm.nodeTypeInfoKanbanBatch',
}

export const DEFAULT_NODE_DATA = {
  description: '',
  cycleTimeMinutes: null,
  completeAccuratePercent: null,
  failRatePercent: null,
  metrics: [],
}
