// Lets any screen open the assistant with a specific context, e.g. from the
// dinner of Thursday: { name: 'menu_slot', label: 'Cena del jueves: …', slotId: 12 }.
import { createContext, useContext } from 'react';

export const AssistantContext = createContext({ openAssistant: () => {} });

export const useAssistant = () => useContext(AssistantContext);
