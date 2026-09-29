/*
 * Copyright (C) 2025 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */


class LeafNode {
    static NUM_LEAF_TYPES = 4;
    constructor()
    {
        this.element = document.createElement('div');
        this.element.className = 'leaf';
        this.element.classList.add(`type-${Stage.randomInt(1, LeafNode.NUM_LEAF_TYPES)}`);
        
        const childElement = document.createElement('div');
        childElement.textContent = this.#randomTextContent();
        this.element.appendChild(childElement);
    }
    
    #randomTextContent()
    {
        const values = [
            '♚',
            '♛',
            '♞',
            '♜',
        ];
        
        return values[Stage.randomInt(0, values.length - 1)];
    }
}


class LayoutController {
    constructor(container, stageSize)
    {
        this._container = container;
        this._stageSize = stageSize;
    }
    
    arrangeItems()
    {
    }
}

class FractalLayoutController extends LayoutController {
    static MAX_CHILDREN_PER_NODE = 4;
    static SLOTS_PER_QUADRANT = 7;
    static SLOTS_PER_LAYER = FractalLayoutController.MAX_CHILDREN_PER_NODE * FractalLayoutController.SLOTS_PER_QUADRANT;

    constructor(container, stageSize)
    {
        super(container, stageSize);
        this._container = container;
        this._stageSize = stageSize;
        this.leafNodes = [];
        // Reuse LeafNode instances by index so complexity C renders the same scene on every ramp.
        this._leafPool = [];
    }
    
    arrangeItems(countDelta)
    {
        if (countDelta > 0)
            this.#addNodes(countDelta);
        else if (countDelta < 0)
            this.#removeNodes(Math.abs(countDelta));
    }

    #addNodes(count)
    {
        for (let i = 0; i < count; ++i)
            this.#insertLeafNode();
    }
    
    #removeNodes(count)
    {
        for (let i = 0; i < count; ++i)
            this.#removeLeafNode();
    }
    
    #slotForLeafIndex(index)
    {
        const layer = Math.floor(index / FractalLayoutController.SLOTS_PER_LAYER);
        const slotInLayer = index % FractalLayoutController.SLOTS_PER_LAYER;
        const quadrant = slotInLayer % FractalLayoutController.MAX_CHILDREN_PER_NODE;
        const stepInQuadrant = (Math.floor(slotInLayer / FractalLayoutController.MAX_CHILDREN_PER_NODE) + quadrant) % FractalLayoutController.SLOTS_PER_QUADRANT;

        const qx = (quadrant % 2) * 0.5;
        const qy = Math.floor(quadrant / 2) * 0.5;
        const splitSubQuadrant = (quadrant + layer) % FractalLayoutController.MAX_CHILDREN_PER_NODE;

        // Interleave three depth-2 (25cqw x 25cqh) slots and four depth-3 (12.5cqw x 12.5cqh) slots per quadrant.
        if (stepInQuadrant === 0 || stepInQuadrant === 2 || stepInQuadrant === 4) {
            const subOffset = (stepInQuadrant / 2) + 1;
            const subQuadrant = (splitSubQuadrant + subOffset) % FractalLayoutController.MAX_CHILDREN_PER_NODE;
            return {
                depth: 2,
                cqFraction: 0.25,
                position: new Point(
                    qx + (subQuadrant % 2) * 0.25,
                    qy + Math.floor(subQuadrant / 2) * 0.25
                ),
            };
        }

        const leafSubIndex = stepInQuadrant === 6 ? 3 : (stepInQuadrant - 1) / 2;
        const subX = qx + (splitSubQuadrant % 2) * 0.25;
        const subY = qy + Math.floor(splitSubQuadrant / 2) * 0.25;
        return {
            depth: 3,
            cqFraction: 0.125,
            position: new Point(
                subX + (leafSubIndex % 2) * 0.125,
                subY + Math.floor(leafSubIndex / 2) * 0.125
            ),
        };
    }

    #positionLeaf(leafNode, index)
    {
        const { depth, cqFraction, position } = this.#slotForLeafIndex(index);
        const pixelGap = 2;
        leafNode.element.style.width = `calc(${100 * cqFraction}cqw - ${pixelGap}px)`;
        leafNode.element.style.height = `calc(${100 * cqFraction}cqh - ${pixelGap}px)`;

        leafNode.element.style.left = `${100 * position.x}cqw`;
        leafNode.element.style.top = `${100 * position.y}cqw`;
        
        leafNode.element.style.setProperty("--depth", depth);
        leafNode.element.style.setProperty("--random", Stage.randomInt(0, 100));
    }

    #insertLeafNode()
    {
        const index = this.leafNodes.length;
        let leafNode = this._leafPool[index];
        if (!leafNode) {
            leafNode = new LeafNode();
            this._leafPool[index] = leafNode;
            this.#positionLeaf(leafNode, index);
        }
        this.leafNodes.push(leafNode);
        this._container.appendChild(leafNode.element);
    }

    #removeLeafNode()
    {
        const leafToRemove = this.leafNodes.pop();
        if (!leafToRemove)
            return;

        leafToRemove.element.remove();
    }
}

class ChessStage extends Stage {
    constructor()
    {
        super();

        this._complexity = 0;
        this._animValue = 0;
        this._startTime = null;
        this._items = [];
    }

    async initialize(benchmark, options)
    {
        await super.initialize(benchmark, options);
        
        this.container = document.getElementById('container');
        const stageRect = this.container.getBoundingClientRect();
        
        this.layout = new FractalLayoutController(this.container, new Size(stageRect.width, stageRect.height));
    }

    tune(countDelta)
    {
        if (countDelta == 0)
            return;

        this.layout.arrangeItems(countDelta);
        this._complexity += countDelta;
    }

    animate()
    {
        this._startTime ??= performance.now();
        this._animValue = (performance.now() - this._startTime) * 0.06;
        this.element.style.setProperty("--anim-value", this._animValue);
    }

    complexity()
    {
        return this._complexity;
    }
}

class ChessBenchmark extends Benchmark {
    constructor(options)
    {
        super(new ChessStage(), options);
    }
}

window.benchmarkClass = ChessBenchmark;

class FakeController {
    constructor()
    {
        this.initialComplexity = 42;
        this.startTime = new Date;
    }

    shouldStop()
    {
        const now = new Date();
        return (now - this.startTime) > 50000;
    }
    
    results()
    {
        return [];
    }
}

// This allows the test HTML file to be loaded directly and run the test with fixed complexity.
window.addEventListener('load', async () => {
    if (!(window === window.parent))
        return;

    const benchmark = new window.benchmarkClass({ });
    benchmark._controller = new FakeController();
    await benchmark.initialize({ });

    benchmark.run().then(function(testData) {
        
    });

}, false);
