import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Input'

interface CourseSettingsProps {
  courses: string[]
  onChange: (courses: string[]) => void
}

export function CourseSettings({ courses, onChange }: CourseSettingsProps) {
  const { customers } = useDashboard()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const usage = (course: string) => customers.filter((c) => c.course === course).length

  const handleAdd = () => {
    const value = name.trim().replace(/\s+/g, ' ')
    if (value.length < 2) {
      setError('Kurs nomi kamida 2 ta belgi')
      return
    }
    if (courses.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setError('Bu kurs ro\'yxatda bor')
      return
    }
    onChange([...courses, value])
    setName('')
    setError('')
  }

  return (
    <div className="settings-rows">
      <ul className="course-list">
        {courses.map((course) => {
          const count = usage(course)
          return (
            <li key={course}>
              <span>
                <strong>{course}</strong>
                <small className="muted">{count > 0 ? `${count} ta mijoz` : 'Mijoz yo\'q'}</small>
              </span>
              <IconButton
                icon="trash"
                tone="danger"
                label={`"${course}" kursini o'chirish`}
                disabled={courses.length <= 1}
                onClick={() => onChange(courses.filter((c) => c !== course))}
              />
            </li>
          )
        })}
      </ul>
      <p className="field-hint">Kurs o'chirilsa, unga yozilgan mijozlar o'zgarmaydi — faqat formalardagi ro'yxatdan chiqadi.</p>
      <div className="inline-form" role="group" aria-label="Yangi kurs">
        <Input
          label="Yangi kurs"
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Masalan: Koreys tili"
        />
        <Button variant="ghost" icon="plus" onClick={handleAdd}>
          Qo'shish
        </Button>
      </div>
    </div>
  )
}
