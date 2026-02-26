import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import TerracePlanterCalculator from '@/calculators/TerracePlanterCalculator'

type Route = '/' | '/calculators/terrace-planter'

type CalculatorMeta = {
  slug: Route
  title: string
  description: string
  status: 'available' | 'coming-soon'
}

const CALCULATORS: CalculatorMeta[] = [
  {
    slug: '/calculators/terrace-planter',
    title: 'Terrace Planter',
    description: 'Configure planter geometry, fabrication thresholds, sheet usage, and sale margin estimates.',
    status: 'available',
  },
]

const normalizeHashRoute = (hash: string): Route | 'not-found' => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const route = (raw || '/').trim().toLowerCase()

  if (route === '/') return '/'
  if (route === '/calculators/terrace-planter') return '/calculators/terrace-planter'

  return 'not-found'
}

const navigateTo = (route: Route) => {
  if (route === '/') {
    window.location.hash = '/'
    return
  }
  window.location.hash = route
}

const CalculatorHub = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Calculator Hub</p>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Choose a calculator</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Select the calculator you want to use. Additional tools can be added here as your website expands.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CALCULATORS.map((calculator) => (
            <Card key={calculator.slug} className="border-border/60 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>{calculator.title}</CardTitle>
                <CardDescription>{calculator.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {calculator.status === 'available' ? (
                  <Button onClick={() => navigateTo(calculator.slug)} className="w-full justify-between">
                    Open calculator
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    Coming soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}

const NotFound = () => (
  <div className="grid min-h-screen place-items-center bg-muted/20 px-4">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Page not found</CardTitle>
        <CardDescription>The page you requested does not exist.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => navigateTo('/')}>Back to calculator hub</Button>
      </CardContent>
    </Card>
  </div>
)

function App() {
  const [hashRoute, setHashRoute] = useState<Route | 'not-found'>(() => normalizeHashRoute(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setHashRoute(normalizeHashRoute(window.location.hash))
    window.addEventListener('hashchange', onHashChange)

    if (!window.location.hash) {
      navigateTo('/')
    }

    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (hashRoute === '/calculators/terrace-planter') {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigateTo('/')}
          className="fixed left-4 top-4 z-[900] h-9"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to hub
        </Button>
        <TerracePlanterCalculator />
      </>
    )
  }

  if (hashRoute === '/') {
    return <CalculatorHub />
  }

  return <NotFound />
}

export default App
