import { MoorhenDraggableModalBase } from "./MoorhenDraggableModalBase"
import { moorhen } from "../../types/moorhen";
import { useRef } from "react";
import { Button, Row } from "react-bootstrap";
import { MoorhenUnmodelledBlobs } from "../validation-tools/MoorhenUnmodelledBlobs"
import { convertRemToPx, convertViewtoPx} from '../../utils/MoorhenUtils';
import { useSelector } from "react-redux";
import { Tooltip } from "@mui/material";
import { LastPageOutlined } from "@mui/icons-material";
import { useSnackbar } from "notistack";

interface MoorhenValidationModalProps extends moorhen.CollectedProps {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MoorhenUnmodelledBlobsModal = (props: MoorhenValidationModalProps) => {        
    const resizeNodeRef = useRef<HTMLDivElement>();
      
    const width = useSelector((state: moorhen.State) => state.sceneSettings.width)
    const height = useSelector((state: moorhen.State) => state.sceneSettings.height)
    
    const { enqueueSnackbar } = useSnackbar()

    const collectedProps = {
        sideBarWidth: convertViewtoPx(35, width), dropdownId: 1, busy: false, 
        accordionDropdownId: 1, setAccordionDropdownId: (arg0) => {}, showSideBar: true, ...props
    }

    return <MoorhenDraggableModalBase
                modalId="unmodelled-blobs-modal"
                left={width / 6}
                top={height / 3}
                show={props.show}
                setShow={props.setShow}
                defaultHeight={convertViewtoPx(70, height)}
                defaultWidth={convertViewtoPx(37, width)}
                minHeight={convertViewtoPx(30, height)}
                minWidth={convertRemToPx(37)}
                maxHeight={convertViewtoPx(70, height)}
                maxWidth={convertViewtoPx(50, width)}
                enforceMaxBodyDimensions={true}
                overflowY='auto'
                overflowX='auto'
                headerTitle='Unmodelled blobs'
                footer={null}
                resizeNodeRef={resizeNodeRef}
                body={
                    <div style={{height: '100%'}} >
                        <Row className={"big-validation-tool-container-row"}>
                            <MoorhenUnmodelledBlobs {...collectedProps}/>
                        </Row>
                    </div>
                }
                additionalHeaderButtons={[
                    <Tooltip title={"Move to side panel"}  key={1}>
                        <Button variant='white' style={{margin: '0.1rem', padding: '0.1rem'}} onClick={() => {
                            props.setShow(false)
                            enqueueSnackbar("unmodelled-blobs", {
                                variant: "sideBar",
                                persist: true,
                                anchorOrigin: {horizontal: "right", vertical: "bottom"},
                                title: "Unmodelled blobs",
                                children: <div style={{maxHeight: '30vh', overflowY: 'scroll', overflowX: "hidden"}} >
                                            <Row className={"big-validation-tool-container-row"}>
                                                <MoorhenUnmodelledBlobs {...collectedProps}/>
                                            </Row>
                                        </div>
                            })
                        }}>
                            <LastPageOutlined/>
                        </Button>
                    </Tooltip>
                ]}

            />
}

