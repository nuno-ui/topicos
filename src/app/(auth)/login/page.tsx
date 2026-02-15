import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">TopicOS</h1>
          <p className="mt-2 text-gray-600">Topic-centric productivity</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
