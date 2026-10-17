import { Route, Switch } from 'wouter';
import { HomePage } from './pages/HomePage';
import { QuizPage } from './pages/QuizPage';

export default function App() {
  return (
    <Switch>
      <Route path="/"     component={HomePage} />
      <Route path="/quiz" component={QuizPage} />
      <Route>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-400">404 – Not Found</p>
        </div>
      </Route>
    </Switch>
  );
}
