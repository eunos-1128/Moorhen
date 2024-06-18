import { useRef } from "react";
import { MoorhenBaseMenuItem } from "./MoorhenBaseMenuItem"
import { moorhen } from "../../types/moorhen";
import { webGL } from "../../types/mgWebGL";
import { MoorhenMoleculeSelect } from "../select/MoorhenMoleculeSelect";
import { useDispatch, useSelector } from 'react-redux';
import { triggerUpdate } from "../../store/moleculeMapUpdateSlice";

export const MoorhenClearSelfRestraintsMenuItem = (props: {
    glRef: React.RefObject<webGL.MGWebGL>;
    commandCentre: React.RefObject<moorhen.CommandCentre>;
    setPopoverIsShown: React.Dispatch<React.SetStateAction<boolean>>;
    popoverPlacement?: 'left' | 'right';
}) => {

    const moleculeSelectRef = useRef<HTMLSelectElement | null>(null)

    const molecules = useSelector((state: moorhen.State) => state.molecules.moleculeList)

    const dispatch = useDispatch()

    const panelContent = <>
        <MoorhenMoleculeSelect
            ref={moleculeSelectRef}
            molecules={molecules}
            filterFunction={(mol) => mol.restraints.length > 0}/>
    </>

    const onCompleted = async () => {
        const selectedMolecule = molecules.find(molecule => molecule.molNo === parseInt(moleculeSelectRef.current.value))
        if (selectedMolecule) {
            await selectedMolecule.clearExtraRestraints()
            dispatch( triggerUpdate(selectedMolecule.molNo) )
        }
        const restraintsRepresenation = selectedMolecule.representations.find(item => item.style === 'restraints')
        if (restraintsRepresenation) {
            selectedMolecule.removeRepresentation(restraintsRepresenation.uniqueId)
        }
    }

    return <MoorhenBaseMenuItem
        id='clear-restraints-menu-item'
        popoverContent={panelContent}
        menuItemText="Clear self-restraints..."
        onCompleted={onCompleted}
        popoverPlacement={props.popoverPlacement}
        setPopoverIsShown={props.setPopoverIsShown}
    />
}

MoorhenClearSelfRestraintsMenuItem.defaultProps = { popoverPlacement: "right" }

