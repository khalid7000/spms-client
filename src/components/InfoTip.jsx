// Small "i" hover-tooltip used next to a label/control to explain unfamiliar terminology in place,
// without cluttering the UI with permanent explanatory text. Matches the existing InfoCircleOutlined
// + #2A5298 convention already used for the annual-evaluation rubric popover (evaluationDisplay.jsx).
import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

export default function InfoTip({ title, placement = 'top', style }) {
  if (!title) return null
  return (
    <Tooltip title={title} placement={placement}>
      <InfoCircleOutlined style={{ color: '#2A5298', marginLeft: 4, cursor: 'help', ...style }} />
    </Tooltip>
  )
}
