import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const Dashboard = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <ChatArea />
    </div>
  );
};

export default Dashboard;
