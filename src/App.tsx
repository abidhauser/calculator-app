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

const HUB_ROUTE = '/calculators' as const
type Route = typeof HUB_ROUTE | '/calculators/terrace-planter'

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

const APP_BASE = (() => {
  const base = (import.meta.env.BASE_URL || '/').trim()
  if (!base || base === '/') return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
})()

const withBase = (route: Route) => {
  const scopedRoute = route === HUB_ROUTE ? `${route}/` : route
  if (!APP_BASE) return scopedRoute
  return `${APP_BASE}${scopedRoute}`
}

const normalizePathRoute = (pathname: string): Route | 'not-found' => {
  const scopedPathname =
    APP_BASE && pathname.startsWith(APP_BASE) ? pathname.slice(APP_BASE.length) || '/' : pathname
  const raw = (scopedPathname || '/').trim().toLowerCase()
  const route = raw !== '/' && raw.endsWith('/') ? raw.slice(0, -1) : raw

  if (route === '/' || route === HUB_ROUTE) return HUB_ROUTE
  if (route === '/calculators/terrace-planter') return '/calculators/terrace-planter'

  return 'not-found'
}

const navigateTo = (route: Route) => {
  const targetPath = withBase(route)
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const CalculatorHub = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Calculator Hub</p>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Choose a calculator</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Select the calculator you want to use.
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
        <Button onClick={() => navigateTo(HUB_ROUTE)}>Back to calculator hub</Button>
      </CardContent>
    </Card>
  </div>
)

function App() {
  const [pathRoute, setPathRoute] = useState<Route | 'not-found'>(() =>
    normalizePathRoute(window.location.pathname),
  )

  useEffect(() => {
    const onPopState = () => setPathRoute(normalizePathRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (pathRoute !== HUB_ROUTE) return
    const hubPath = withBase(HUB_ROUTE)
    if (window.location.pathname === hubPath) return
    window.history.replaceState({}, '', hubPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [pathRoute])

  if (pathRoute === '/calculators/terrace-planter') {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigateTo(HUB_ROUTE)}
          className="fixed left-4 top-4 z-[900] h-9"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to hub
        </Button>
        <TerracePlanterCalculator />
      </>
    )
  }

  if (pathRoute === HUB_ROUTE) {
    return <CalculatorHub />
  }

  return <NotFound />
}

export default App
