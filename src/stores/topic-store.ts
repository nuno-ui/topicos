import { create } from 'zustand';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  parent_topic_id: string | null;
  is_ongoing?: boolean;
}

interface TopicStore {
  topics: Topic[];
  selectedTopicId: string | null;
  setTopics: (topics: Topic[]) => void;
  addTopic: (topic: Topic) => void;
  setSelectedTopicId: (id: string | null) => void;
}

export const useTopicStore = create<TopicStore>((set) => ({
  topics: [],
  selectedTopicId: null,
  setTopics: (topics) => set({ topics }),
  addTopic: (topic) => set((state) => ({ topics: [topic, ...state.topics] })),
  setSelectedTopicId: (id) => set({ selectedTopicId: id }),
}));
