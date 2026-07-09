// Admin/HR screen: browse concluded Annual Evaluations for a given academic year and
// download the final signed report as a PDF. Visible to both ADMIN and HR roles (unlike
// the rest of the admin console, which is ADMIN-only) -- see ProtectedRoute's requiredRoles.
import { useState } from 'react'
import { Card, Select, Table, Tag, Button, message, Empty, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getAcademicYears } from '../../api/academicYears'
import { getConcludedEvaluations, downloadEvaluationPdf } from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'

const { Paragraph } = Typography

const TABLE_PREFS_KEY = 'spms.evaluationReportsTable.prefs'

export default function EvaluationReportsPage() {
  const [academicYearId, setAcademicYearId] = useState(null)
  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: academicYears = [] } = useQuery({ queryKey: ['academic-years'], queryFn: getAcademicYears })

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['concluded-evaluations', academicYearId],
    queryFn: () => getConcludedEvaluations(academicYearId),
    enabled: !!academicYearId,
  })

  const handleDownload = async (evaluation) => {
    try {
      const resp = await downloadEvaluationPdf(evaluation.id)
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `annual-evaluation-${evaluation.employeeName.replace(/\s+/g, '-')}-${evaluation.academicYearName}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to download report')
    }
  }

  const columns = [
    {
      title: 'Employee', dataIndex: 'employeeName', key: 'employeeName',
      sorter: (a, b) => compareStrings(a.employeeName, b.employeeName), sortOrder: sortOrderFor('employeeName'),
    },
    { title: 'Head', dataIndex: 'headName', key: 'headName' },
    { title: 'Overall Rank', dataIndex: 'headOverallRank', key: 'headOverallRank' },
    {
      title: 'Concluded', dataIndex: 'headSignedAt', key: 'headSignedAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    { title: 'Status', dataIndex: 'state', key: 'state', render: () => <Tag color="success">CONCLUDED</Tag> },
    {
      title: 'Report', key: 'report',
      render: (_, row) => (
        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(row)}>Download PDF</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Annual Evaluation Reports</h1>
      </div>
      <Card>
        <Paragraph type="secondary">
          Only concluded evaluations (signed by the head, and signed or refused by the employee) appear here.
        </Paragraph>
        <Select
          style={{ width: 220, marginBottom: 16 }} placeholder="Academic year" value={academicYearId}
          onChange={setAcademicYearId} options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />
        {!academicYearId ? (
          <Empty description="Select an academic year" />
        ) : (
          <Table
            dataSource={evaluations} columns={columns} rowKey="id" loading={isLoading}
            pagination={{
              current: prefs.current, pageSize: prefs.pageSize, showSizeChanger: true,
              showTotal: (total) => `Total: ${total}`,
            }}
            onChange={handleTableChange}
            locale={{ emptyText: 'No concluded evaluations for this year yet' }}
          />
        )}
      </Card>
    </div>
  )
}
