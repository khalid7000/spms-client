// Quick "Add Achievement" flow launched from the dashboard's big Add Achievement button: pick a
// strategy (skipped automatically when it's obvious -- exactly one eligible strategy, or the last
// 5 strategy-detail-page visits in a row were all the same one), then pick an initiative from a
// board grouped by objective, then the normal achievement form. Reuses the same
// AchievementModal/useAddAchievementMutation and initiative-pickability logic as the Strategy
// Tree's own AchievementRail (StrategyTree.jsx) -- only the picker UI (grouped boxes instead of a
// flat search list) is new.
import { useEffect, useState } from 'react'
import { Modal, Button, Spin, Empty, Typography } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useStrategyYearContext } from '../hooks/useStrategyYearContext'
import { getStreakStrategyId } from '../hooks/useRecentStrategyVisits'
import { canRecordAchievement, resolveFixedPeriod } from '../utils/achievements'
import { AchievementModal, useAddAchievementMutation } from './AchievementModal'
import StateChip from './StateChip'
import RoleChip from './RoleChip'

const { Text } = Typography

export default function AddAchievementWizard({ open, onClose, strategies }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const eligible = strategies.filter((s) => canRecordAchievement(s.role, s.state))

  const [step, setStep] = useState('strategy')
  const [selectedStrategyId, setSelectedStrategyId] = useState(null)
  const [quickAddTarget, setQuickAddTarget] = useState(null)

  // Resolve the starting step fresh every time the wizard opens -- eligibility and visit history
  // can both have changed since it was last opened.
  useEffect(() => {
    if (!open) return
    setQuickAddTarget(null)
    if (eligible.length === 0) {
      setStep('empty')
      setSelectedStrategyId(null)
      return
    }
    if (eligible.length === 1) {
      setSelectedStrategyId(eligible[0].strategyId)
      setStep('initiative')
      return
    }
    const streakId = getStreakStrategyId()
    const streakMatch = streakId && eligible.find((s) => String(s.strategyId) === String(streakId))
    if (streakMatch) {
      setSelectedStrategyId(streakMatch.strategyId)
      setStep('initiative')
      return
    }
    setSelectedStrategyId(null)
    setStep('strategy')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const { strategy, strategyLoading, academicYearId, academicYears, assessmentPeriods } =
    useStrategyYearContext(step === 'initiative' ? selectedStrategyId : null)

  const quickAddMut = useAddAchievementMutation(
    quickAddTarget?.initiative.measurements, quickAddTarget?.initiative.id, selectedStrategyId,
    () => {
      setQuickAddTarget(null)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  )

  const handleClose = () => {
    setQuickAddTarget(null)
    onClose()
  }

  const objectiveGroups = []
  ;(strategy?.goals ?? []).forEach((g) => {
    ;(g.objectives ?? []).forEach((o) => objectiveGroups.push({ objective: o, goalTitle: g.title }))
  })

  return (
    <>
      <Modal
        title={t('addAchievementWizard.title')}
        open={open && !quickAddTarget}
        onCancel={handleClose}
        footer={null}
        width={step === 'initiative' ? 720 : 480}
        destroyOnClose
      >
        {step === 'empty' && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('addAchievementWizard.noEligibleStrategy')}
          />
        )}

        {step === 'strategy' && (
          <div>
            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>{t('addAchievementWizard.selectStrategyTitle')}</Text>
            <Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 14 }}>
              {t('addAchievementWizard.selectStrategyHint')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
              {eligible.map((s) => (
                <div
                  key={s.strategyId}
                  className="wizard-strategy-pick"
                  onClick={() => { setSelectedStrategyId(s.strategyId); setStep('initiative') }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.strategyTitle}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                    <StateChip state={s.state} />
                    <RoleChip role={s.role} />
                    {s.departmentName && <Text type="secondary" style={{ fontSize: 12 }}>{s.departmentName}</Text>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'initiative' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>{t('addAchievementWizard.selectInitiativeTitle')}</Text>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  {strategy ? t('addAchievementWizard.forStrategy', { title: strategy.title }) : ' '}
                </Text>
              </div>
              {eligible.length > 1 && (
                <Button
                  type="link" size="small" icon={<LeftOutlined />} style={{ padding: 0 }}
                  onClick={() => { setSelectedStrategyId(null); setStep('strategy') }}
                >
                  {t('addAchievementWizard.changeStrategy')}
                </Button>
              )}
            </div>

            {strategyLoading || !strategy ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : objectiveGroups.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('addAchievementWizard.noObjectivesYet')} />
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto', paddingTop: 6 }}>
                {objectiveGroups.map(({ objective, goalTitle }) => (
                  <div key={objective.id} className="objective-box">
                    <div className="objective-box-label">{objective.title}</div>
                    {goalTitle !== objective.title && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{goalTitle}</div>
                    )}
                    {(objective.initiatives ?? []).length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12.5 }}>{t('addAchievementWizard.noInitiativesYet')}</Text>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {objective.initiatives.map((ini) => {
                          const hasMeasurement = (ini.measurements?.length ?? 0) > 0
                          const period = resolveFixedPeriod(ini, academicYearId, academicYears, assessmentPeriods)
                          const pickable = hasMeasurement && !!period
                          return (
                            <div
                              key={ini.id}
                              className="initiative-pick-card"
                              style={{ opacity: pickable ? 1 : 0.5, cursor: pickable ? 'pointer' : 'not-allowed' }}
                              onClick={() => { if (pickable) setQuickAddTarget({ initiative: ini, period }) }}
                            >
                              <div className="t">{ini.title}</div>
                              {!hasMeasurement && <div className="s">{t('addAchievementWizard.needsKpiHint')}</div>}
                              {hasMeasurement && !period && <div className="s">{t('addAchievementWizard.selectYearHint')}</div>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <AchievementModal
        open={!!quickAddTarget} onClose={() => setQuickAddTarget(null)}
        onSave={quickAddMut.mutate} loading={quickAddMut.isPending}
        title={quickAddTarget ? t('tree.recordAchievementFor', { name: quickAddTarget.initiative.title }) : t('tree.recordAchievement')}
        assessmentPeriods={assessmentPeriods} academicYears={academicYears} academicYearId={academicYearId}
        initialPeriodName={quickAddTarget?.period?.name}
        initialValues={{ assessmentPeriodId: quickAddTarget?.period?.id }}
      />
    </>
  )
}
