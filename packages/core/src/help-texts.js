// Help texts the info sheets show (CBSL rules, billing cycles, Spaces, the payoff plan...). Shared so both
// apps explain things in the same words. Moved from InfoSheet in index.html (Phase 3). Text is trusted
// app content (it may contain simple inline markup such as <strong>).
export var HELP_TEXTS = {
        spaces_info: {
          icon: "savings",
          iconBg: "bg-emerald-50",
          iconColor: "text-emerald-600",
          title: "Sinking Funds",
          subtitle: "Why they matter for debt management",
          body: [
            { type: "p", text: "Spaces allow you to ring-fence money ahead of time for upcoming bills or unexpected expenses." },
            {
              type: "rule", items: [
                { icon: "shield", label: "Debt Buffer", value: "Protects you from using credit cards for emergencies", color: "text-emerald-600" },
                { icon: "account_balance_wallet", label: "Repayment Fund", value: "Accumulate cash to pay off high-interest cards", color: "text-emerald-600" }
              ]
            },
            {
              type: "highlight", bg: "bg-emerald-50", border: "border-emerald-200", icon: "lightbulb", iconColor: "text-emerald-600",
              text: "Building sinking funds parallel to your debt payoff helps you permanently break the credit reliance cycle."
            }
          ]
        },
        billing: {
          icon: "calendar_month",
          iconBg: "bg-blue-50",
          iconColor: "text-blue-600",
          title: "Billing Cycle",
          subtitle: "How your monthly statement works",
          body: [
            { type: "p", text: "Your billing cycle is a fixed 30\u2013day period after which your bank generates a statement with the total amount owed." },
            {
              type: "rule", items: [
                { icon: "event", label: "Statement date", value: "28th of each month (typical)", color: "text-blue-600" },
                { icon: "schedule", label: "Payment due", value: "~21 days after statement date", color: "text-amber-600" },
                { icon: "percent", label: "Grace period", value: "Interest-free if full balance paid by due date", color: "text-primary" }
              ]
            },
            {
              type: "highlight", bg: "bg-blue-50", border: "border-blue-200", icon: "lightbulb", iconColor: "text-blue-600",
              text: "Pay your full statement balance by the due date each month to enjoy a completely interest-free credit line."
            }
          ]
        },
        apr: {
          icon: "account_balance",
          iconBg: "bg-amber-50",
          iconColor: "text-amber-700",
          title: "28% APR \u2014 CBSL Ceiling Rate",
          subtitle: "Central Bank of Sri Lanka regulation",
          body: [
            { type: "p", text: "The Central Bank of Sri Lanka (CBSL) caps credit card interest at 28% per annum. All Sri Lankan banks must apply this rate or lower." },
            {
              type: "rule", items: [
                { icon: "percent", label: "Annual rate (APR)", value: "28.00%", color: "text-amber-700" },
                { icon: "calendar_month", label: "Monthly rate", value: "2.333%", color: "text-amber-700" },
                { icon: "today", label: "Daily rate", value: "0.0767%", color: "text-amber-700" },
                { icon: "trending_up", label: "Compounding method", value: "Monthly on unpaid balance", color: "text-secondary" }
              ]
            },
            {
              type: "highlight", bg: "bg-rose-50", border: "border-rose-200", icon: "warning", iconColor: "text-error",
              text: "Interest is charged on your entire outstanding balance if even Rs. 1 remains unpaid after the due date \u2014 not just the unpaid portion."
            },
            { type: "p", text: "Source: CBSL Direction No. 3 of 2021 on Maximum Interest Rates applicable to Credit Cards." }
          ]
        },
        payoff: {
          icon: "warning",
          iconBg: "bg-rose-50",
          iconColor: "text-rose-600",
          title: "The Minimum Payment Trap",
          subtitle: "Why paying only the minimum is dangerous",
          body: [
            { type: "p", text: "Banks require only 4% of your outstanding balance (minimum Rs. 1,000) as a monthly payment. While this feels affordable, it is designed to keep you in debt longer." },
            {
              type: "rule", items: [
                { icon: "remove_circle", label: "Minimum payment", value: "4% of balance (min Rs. 1,000)", color: "text-error" },
                { icon: "percent", label: "Interest accrues", value: "28% APR on remaining balance", color: "text-error" },
                { icon: "hourglass_bottom", label: "Result", value: "Most of your payment covers interest, not principal", color: "text-secondary" }
              ]
            },
            {
              type: "example",
              title: "Example: Rs. 100,000 balance",
              rows: [
                { label: "Minimum payment/mo", value: "Rs. 4,000", bold: false },
                { label: "Interest charged/mo", value: "Rs. 2,333", bold: false },
                { label: "Actual principal paid", value: "Rs. 1,667", bold: false },
                { label: "Years to pay off", value: "~12 years", bold: true },
                { label: "Total interest paid", value: "~Rs. 93,000", bold: true }
              ]
            },
            {
              type: "highlight", bg: "bg-emerald-50", border: "border-emerald-200", icon: "bolt", iconColor: "text-primary",
              text: "Paying just Rs. 8,000/month (2\u00d7 the minimum) on the same balance would clear it in ~14 months and save over Rs. 75,000 in interest."
            }
          ]
        },
        apr_profile: {
          icon: "account_balance",
          iconBg: "bg-amber-50",
          iconColor: "text-amber-700",
          title: "Maximum APR Cap",
          subtitle: "Central Bank of Sri Lanka regulation",
          body: [
            { type: "p", text: "The Central Bank of Sri Lanka (CBSL) enforces a maximum interest rate cap of 28% per annum on all credit card advances under the Monetary Law Act to regulate consumer lending." }
          ]
        },
        strategy_acceleration: {
          icon: "speed",
          iconBg: "bg-teal-50",
          iconColor: "text-teal-600",
          title: "Target Repayment Pace",
          subtitle: "Automated Strategy Allocation",
          body: [
            { type: "p", text: "This bar tracks your total monthly commitment across all cards. It dynamically scales based on the \"Simulate monthly payment\" values you save for individual cards." },
            { type: "p", text: "By increasing your target payment above the bank minimums, you aggressively accelerate your debt-free date and minimize compounding interest." }
          ]
        },
        min_pmt_profile: {
          icon: "warning",
          iconBg: "bg-rose-50",
          iconColor: "text-rose-600",
          title: "Minimum Payment Trap",
          subtitle: "CBSL Statutory Minimum",
          body: [
            { type: "p", text: "CBSL mandates that banks accept a minimum payment of 4% of the balance. While this prevents default and late fees, paying only this amount retroactively voids your grace period and maximizes the compound interest paid to the bank." }
          ]
        },
        crib: {
          icon: "warning",
          iconBg: "bg-error-container",
          iconColor: "text-error",
          title: "CRIB Default Classification",
          subtitle: "Central Bank of Sri Lanka",
          body: [
            { type: "p", text: "The Central Bank of Sri Lanka (CBSL) classifies credit facilities past due for more than 90 days as Non-Performing Credit Facilities (NPCF). This severely restricts future borrowing across the banking sector." }
          ]
        },
        surcharge_rules: {
          icon: "gavel",
          iconBg: "bg-amber-50",
          iconColor: "text-amber-700",
          title: "Merchant Surcharge Rules",
          subtitle: "Visa, Mastercard & CBSL Guidelines",
          body: [
            { type: "p", text: "Under standard Visa and Mastercard network rules, merchants are generally prohibited from passing the Merchant Discount Rate (swipe fee) directly to the consumer as a line-item credit card surcharge. Knowing this true cost helps you negotiate better cash prices or identify unfair point-of-sale penalties." }
          ]
        }
      };
