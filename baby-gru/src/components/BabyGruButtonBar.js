import { createRef, useCallback, useRef, useState } from "react";
import { ButtonGroup, Button, Popover, Overlay } from "react-bootstrap"
import { cootCommand, postCootMessage } from "../BabyGruUtils"
import { circles_fragment_shader_source } from "../WebGL/circle-fragment-shader";

export const BabyGruButtonBar = (props) => {
    const atomClickedBinding = createRef(null);
    const [selectedbuttonIndex, setSelectedbuttonIndex] = useState(null)

    return <div
        style={{
            overflow: "auto",
            backgroundColor: "white",
        }}>
        <ButtonGroup vertical>

            <BabyGruSimpleEditButton {...props}
                buttonIndex={"0"}
                selectedbuttonIndex={selectedbuttonIndex}
                setSelectedbuttonIndex={setSelectedbuttonIndex}
                cootCommand="auto_fit_rotamer"
                icon={<img className="baby-gru-button-icon" src="pixmaps/auto-fit-rotamer.svg" />}
                formatArgs={(molecule, chosenAtom) => {
                    return [
                        molecule.coordMolNo,
                        chosenAtom.chain_id,
                        chosenAtom.res_no,
                        chosenAtom.ins_code,
                        chosenAtom.alt_conf,
                        props.activeMap.mapMolNo]
                }} />

            <BabyGruSimpleEditButton {...props}
                buttonIndex={"1"}
                selectedbuttonIndex={selectedbuttonIndex}
                setSelectedbuttonIndex={setSelectedbuttonIndex}
                cootCommand="flipPeptide_cid"
                icon={<img className="baby-gru-button-icon" src="pixmaps/flip-peptide.svg" />}
                formatArgs={(molecule, chosenAtom) => {
                    return [
                        molecule.coordMolNo,
                        `//${chosenAtom.chain_id}/${chosenAtom.res_no}`,
                        '']
                }} />

        </ButtonGroup>
    </div>
}

const BabyGruSimpleEditButton = (props) => {
    const [showPrompt, setShowPrompt] = useState(false)
    const target = useRef(null);

    const atomClickedCallback = useCallback(event => {
        props.molecules.forEach(molecule => {
            setShowPrompt(false)
            props.setCursorStyle("default")
            const chosenAtom = cidToSpec(event.detail)
            cootCommand(props.cootWorker, {
                returnType: "status",
                command: props.cootCommand,
                commandArgs: props.formatArgs(molecule, chosenAtom)
            }).then(_ => {
                molecule.setAtomsDirty(true)
                molecule.redraw(props.glRef)
                props.setSelectedbuttonIndex(null)
            })
        })
    })

    return <>
        <Button value={props.buttonIndex}
            ref={target}
            active={props.buttonIndex === props.selectedbuttonIndex}
            variant='light'
            disabled={props.buttonIndex==0&&!props.activeMap || props.buttonIndex==1&&props.molecules.length===0}
            onClick={(e) => {
                if (props.selectedbuttonIndex === e.currentTarget.value) {
                    props.setSelectedbuttonIndex(null)
                    props.setCursorStyle("default")
                    document.removeEventListener('atomClicked', atomClickedCallback, { once: true })
                    setShowPrompt(false)
                    return
                }
                props.setSelectedbuttonIndex(props.buttonIndex)
                props.setCursorStyle("crosshair")
                document.addEventListener('atomClicked', atomClickedCallback, { once: true })
                setShowPrompt(true)
            }}>
            {props.icon}
        </Button>

        <Overlay target={target.current} show={showPrompt} placement="left">
            {({ placement, arrowProps, show: _show, popper, ...props }) => (
                <div
                    {...props}
                    style={{
                        position: 'absolute',
                        backgroundColor: 'rgba(255, 100, 100, 0.85)',
                        padding: '2px 10px',
                        color: 'white',
                        borderRadius: 3,
                        ...props.style,
                    }}
                >Click an atom
                </div>
            )}
        </Overlay>
    </>
}

const cidToSpec = (cid) => {
    //coordMolNo, chain_id, res_no, ins_code, alt_conf
    const cidTokens = cid.split('/')
    const chain_id = cidTokens[2]
    const res_no = parseInt(cidTokens[3])
    const atom_name = cidTokens[4]
    const ins_code = ""
    const alt_conf = ""
    return { chain_id, res_no, atom_name, ins_code, alt_conf }
}