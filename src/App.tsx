import SimulatorContainer from './containers/simulator/SimulatorContainer'
import { SimulatorProvider } from './contexts/SimulatorContext'

function App() {
  return (
    <SimulatorProvider>
      <SimulatorContainer />
    </SimulatorProvider>
  )
}

export default App
