import { Route, Switch } from 'wouter';
import { HomePage } from './pages/HomePage';

export default function App() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-400">404 - Not Found</p>
        </div>
      </Route>
    </Switch>
  );
}
