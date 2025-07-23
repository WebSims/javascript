import { Routes, Route } from 'react-router'
import SimulatorContainer from './containers/simulator/SimulatorContainer'
import { SimulatorProvider } from './contexts/SimulatorContext'

const routes = [
  {
    path: "/",
    element: (
      <SimulatorProvider>
        <SimulatorContainer />
      </SimulatorProvider>
    )
  },
  {
    path: "/examples/:exampleId",
    element: (
      <SimulatorProvider>
        <SimulatorContainer />
      </SimulatorProvider>
    )
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
