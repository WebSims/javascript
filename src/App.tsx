import { Routes, Route } from 'react-router'
import SimulatorContainer from './containers/simulator/SimulatorContainer'
import { SimulatorProvider } from './contexts/SimulatorContext'
import { useModeToggle } from './hooks/useModeToggle'

const SimulatorWrapper = () => {
  const { currentMode } = useModeToggle()

  return (
    <SimulatorProvider mode={currentMode}>
      <SimulatorContainer />
    </SimulatorProvider>
  )
}

const routes = [
  {
    path: "/",
    element: <SimulatorWrapper />
  },
  {
    path: "/examples/:exampleId",
    element: <SimulatorWrapper />
  },
  // Add more routes here as needed, with or without providers
]

function App() {
  return (
    <Routes>
      {routes.map(({ path, element }, idx) => (
        <Route key={idx} path={path} element={element} />
      ))}
    </Routes>
  )
}

export default App
