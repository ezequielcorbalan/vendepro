'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import TrialBanner from '@/components/layout/TrialBanner'
import NewPaymentModal from '@/components/payments/NewPaymentModal'
import NewExpenseModal from '@/components/expenses/NewExpenseModal'

export default function RentalsLayout({ children }: { children: React.ReactNode }) {
  const [paymentModal, setPaymentModal] = useState(false)
  const [expenseModal, setExpenseModal] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onNewPayment={() => setPaymentModal(true)}
        onNewExpense={() => setExpenseModal(true)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TrialBanner />
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>

      {paymentModal && (
        <NewPaymentModal
          onClose={() => setPaymentModal(false)}
          onCreated={() => setPaymentModal(false)}
        />
      )}
      {expenseModal && (
        <NewExpenseModal
          onClose={() => setExpenseModal(false)}
          onCreated={() => setExpenseModal(false)}
        />
      )}
    </div>
  )
}
