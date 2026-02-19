import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestTimeline from '../RequestTimeline.vue'

describe('RequestTimeline', () => {
  it('parses JSON activities and renders timeline', () => {
    const activities = JSON.stringify([
      {
        timestamp: '2026-02-19T10:30:00Z',
        type: '前台行動',
        actionType: '打電話',
        content: '客戶確認',
        createdBy: 1000123,
      },
      {
        timestamp: '2026-02-19T14:00:00Z',
        type: '狀態改變',
        actionType: '已指派',
        content: '已指派給銷售',
        createdBy: 1000124,
      },
    ])

    const wrapper = mount(RequestTimeline, {
      props: { activities },
    })

    const items = wrapper.findAll('.timeline-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('打電話')
    expect(items[1].text()).toContain('已指派')
  })

  it('handles empty activities gracefully', () => {
    const wrapper = mount(RequestTimeline, {
      props: { activities: '[]' },
    })
    expect(wrapper.text()).toContain('無活動記錄')
  })

  it('handles invalid JSON', () => {
    const wrapper = mount(RequestTimeline, {
      props: { activities: 'invalid' },
    })
    expect(wrapper.text()).toContain('無活動記錄')
  })
})
