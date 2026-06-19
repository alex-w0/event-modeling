import { ReactFlowProvider } from '@xyflow/react';
import Board from './Board';
import { ContextsProvider } from './components/ContextsContext';
import { TypesProvider } from './components/TypesContext';
import { DialogProvider } from './components/Dialog';
import { DnDProvider } from './components/DnDContext';
import { DropHighlightProvider } from './components/DropHighlightContext';
import { ElementEditorProvider } from './components/ElementEditorContext';
import { FlowTraceProvider } from './components/FlowTraceContext';
import { WireframeEditorProvider } from './components/wireframe/WireframeEditorContext';

export default function App() {
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100">
      <DialogProvider>
        <ReactFlowProvider>
          <ContextsProvider>
            <TypesProvider>
              <WireframeEditorProvider>
                <ElementEditorProvider>
                  <FlowTraceProvider>
                    <DnDProvider>
                      <DropHighlightProvider>
                        <Board />
                      </DropHighlightProvider>
                    </DnDProvider>
                  </FlowTraceProvider>
                </ElementEditorProvider>
              </WireframeEditorProvider>
            </TypesProvider>
          </ContextsProvider>
        </ReactFlowProvider>
      </DialogProvider>
    </div>
  );
}
